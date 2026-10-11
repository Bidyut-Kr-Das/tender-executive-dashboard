"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/v2/ui/button";
import { describeError, toastError } from "@/components/v2/ui/errors";
import { Dialog } from "@/components/v2/ui/overlay";

/** JSON request to one of the admin routes; a refusal throws the server's message. */
export async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || "Request failed");
  return data as T;
}

/**
 * The rows of an admin list, loaded once. A save or delete patches them here
 * with `upsert` and `remove`, so the list is never fetched again after an edit.
 * `load` must be a stable function.
 */
export function useRows<T extends { id: number }>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await load());
      setError(null);
    } catch (err) {
      setError(await describeError(err));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const upsert = useCallback((...saved: T[]) => {
    setRows((prev) => {
      const next = [...prev];
      for (const row of saved) {
        const at = next.findIndex((r) => r.id === row.id);
        if (at === -1) next.push(row);
        else next[at] = row;
      }
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, error, reload, upsert, remove };
}

/** Edit and delete for one row; delete asks first. */
export function RowActions({
  what,
  onEdit,
  onDelete,
}: {
  /** What is removed, as the confirmation names it: `mapping "Tender ID"`. */
  what: string;
  onEdit: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirm = () => {
    setDeleting(true);
    onDelete()
      .then(() => {
        toast.success(`Removed ${what}`);
        setConfirming(false);
      })
      .catch((err) => toastError("Not removed", err))
      .finally(() => setDeleting(false));
  };

  return (
    <div className="flex gap-0.5">
      <IconButton size="sm" label="Edit" onClick={onEdit}>
        <Pencil className="size-3.5" />
      </IconButton>
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
