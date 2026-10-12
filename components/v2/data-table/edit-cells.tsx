"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "@/components/v2/ui/button";
import { toastError } from "@/components/v2/ui/errors";
import { Dash, Input, Textarea } from "@/components/v2/ui/field";
import { Select, type SelectOption } from "@/components/v2/ui/overlay";
import { CellAction, Clamp } from "./cells";

/**
 * Editing cells for any page. They know nothing about the row: the column
 * definition hands in the current value and a `onSave` that dispatches the
 * page's own thunk or request. A rejected save shows a toast and the old value.
 */

interface EditProps {
  /** Names the field in the control's accessible name and in toasts. */
  label: string;
  value: string;
  onSave: (next: string) => Promise<unknown>;
  /** Plain display with no edit control. */
  readOnly?: boolean;
}

function useSave(label: string, onSave: EditProps["onSave"]) {
  const [pending, setPending] = useState(false);
  const save = (next: string) => {
    setPending(true);
    return onSave(next)
      .then(() => {
        toast.success(`${label} updated`);
        return true;
      })
      .catch((err: unknown) => {
        toastError(`${label} not saved`, err);
        return false;
      })
      .finally(() => setPending(false));
  };
  return { pending, save };
}

/** Text with a pencil; Enter or leaving the box saves, Escape cancels. */
export function TextEditCell({
  label,
  value,
  onSave,
  readOnly,
  multiline,
  masked,
  validate,
}: EditProps & {
  multiline?: boolean;
  /** Shown as dots until revealed with the eye button. */
  masked?: boolean;
  /** A problem with the typed value, or null to accept it. */
  validate?: (next: string) => string | null;
}) {
  const { pending, save } = useSave(label, onSave);
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const Control = multiline ? Textarea : Input;

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    if (next === value) return setDraft(value);
    const problem = validate?.(next);
    if (problem) {
      toast.error(`${label}: ${problem}`);
      return setDraft(value);
    }
    save(next).then((ok) => {
      if (!ok) setDraft(value);
    });
  };

  if (!editing) {
    return (
      <CellAction
        pending={pending}
        action={
          <>
            {masked && value && (
              <IconButton
                size="sm"
                label={revealed ? `Hide ${label}` : `Show ${label}`}
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </IconButton>
            )}
            {!readOnly && (
              <IconButton size="sm" label={`Edit ${label}`} onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
              </IconButton>
            )}
          </>
        }
      >
        {!value ? (
          <Dash />
        ) : masked && !revealed ? (
          <span aria-label="Hidden">••••••••</span>
        ) : (
          <Clamp className={masked ? "font-mono" : undefined}>{value}</Clamp>
        )}
      </CellAction>
    );
  }

  return (
    <Control
      aria-label={label}
      autoFocus
      rows={2}
      disabled={pending}
      value={draft}
      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value)
      }
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.stopPropagation();
          cancelled.current = true;
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

const CLEAR = "__clear__";

/** One value from a short list, saved on pick. */
export function SelectEditCell({
  label,
  value,
  onSave,
  readOnly,
  options,
  required,
}: EditProps & {
  options: SelectOption[];
  /** Leaves out the "Not set" choice. */
  required?: boolean;
}) {
  const { pending, save } = useSave(label, onSave);
  if (readOnly) return value ? <Clamp>{value}</Clamp> : <Dash />;
  // An older value outside the list stays visible until it is replaced.
  const listed =
    !value || options.some((o) => o.value === value)
      ? options
      : [{ value, label: value }, ...options];
  return (
    <Select
      size="sm"
      label={label}
      placeholder="Not set"
      value={value || null}
      disabled={pending}
      options={required ? listed : [{ value: CLEAR, label: "Not set" }, ...listed]}
      onChange={(picked) => {
        const next = !picked || picked === CLEAR ? "" : picked;
        if (next !== value) save(next);
      }}
    />
  );
}
