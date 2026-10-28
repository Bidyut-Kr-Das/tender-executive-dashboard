"use client";

import { useId, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, IconButton } from "./button";
import { describeError, toastError } from "./errors";
import { Dialog } from "./overlay";
import { say } from "@/lib/pip-says";

/** Edit and delete for one row; delete asks first. */
export function RowActions({
  what,
  onEdit,
  onDelete,
}: {
  /** What is removed, as the confirmation names it: `mapping "Tender ID"`. */
  what: string;
  /** Omit for a row that can only be removed. */
  onEdit?: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirm = () => {
    setDeleting(true);
    onDelete()
      .then(() => {
        toast.success(say.removed(what));
        setConfirming(false);
      })
      .catch((err) => toastError(say.couldNot("remove it"), err))
      .finally(() => setDeleting(false));
  };

  return (
    <div className="flex gap-0.5">
      {onEdit && (
        <IconButton size="sm" label="Edit" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconButton>
      )}
      <IconButton size="sm" label="Remove" onClick={() => setConfirming(true)}>
        <Trash2 className="size-3.5" />
      </IconButton>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${what}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirm}>
              Remove
            </Button>
          </>
        }
      />
    </div>
  );
}

/**
 * A dialog around one form. It holds the draft, starting from `initial` each
 * time it opens. `onSubmit` throws to refuse: the message shows in the dialog
 * and it stays open.
 */
export function FormDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  width,
  initial,
  onSubmit,
  submitLabel = "Save",
  extraActions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  width?: string;
  initial: T;
  /** `setValue` lets a refusal mark up the draft (per-row errors) before it throws. */
  onSubmit: (value: T, setValue: (next: T) => void) => Promise<void>;
  submitLabel?: string | ((value: T) => string);
  /** Buttons before Cancel that change the draft. */
  extraActions?: (value: T, setValue: (next: T) => void) => ReactNode;
  children: (value: T, set: (patch: Partial<T>) => void) => ReactNode;
}) {
  const formId = useId();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start over on each open; the draft stays put while the dialog closes.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(initial);
      setError(null);
    }
  }

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(value, setValue);
      onOpenChange(false);
    } catch (err) {
      setError(await describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width={width}
      footer={
        <>
          {extraActions?.(value, setValue)}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={saving}>
            {typeof submitLabel === "function" ? submitLabel(value) : submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {children(value, (patch) => setValue((prev) => ({ ...prev, ...patch })))}
        {error && (
          <p role="alert" className="text-bad">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
