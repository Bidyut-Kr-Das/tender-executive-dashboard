"use client";

import { memo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

interface EmdEditableCellProps {
  /** Current persisted value for the cell. */
  value: string;
  /** True while a save for this cell is in flight. */
  updating: boolean;
  placeholder: string;
  /** Shown in place of an empty value, e.g. "— Add email". */
  emptyLabel: string;
  /** Tooltip when the cell has no value. */
  emptyTitle?: string;
  /** Returns the invalid tokens in a value, or an empty array when valid. */
  validate?: (value: string) => string[];
  onSave: (next: string | null) => void;
}

/**
 * One inline-editable table cell.
 *
 * The draft text lives in this component rather than on the page, which is the
 * point of the extraction: previously every keystroke updated page-level state
 * and re-rendered the entire 45-column table. Now a keystroke re-renders only
 * the cell being edited.
 */
export const EmdEditableCell = memo(function EmdEditableCell({
  value,
  updating,
  placeholder,
  emptyLabel,
  emptyTitle,
  validate,
  onSave,
}: EmdEditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const invalidDraft = validate && draft.trim() !== "" ? validate(draft) : [];
  const hasInvalidDraft = invalidDraft.length > 0;

  if (editing) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-1">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            rows={2}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: "6px",
              border: `1px solid ${hasInvalidDraft ? "var(--danger)" : "var(--input)"}`,
              fontSize: "12px",
              resize: "vertical",
              minHeight: "56px",
            }}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                if (hasInvalidDraft) return;
                const trimmed = draft.trim();
                onSave(trimmed === "" ? null : trimmed);
                setEditing(false);
              }}
              disabled={updating || hasInvalidDraft}
              style={{
                padding: "6px",
                borderRadius: "4px",
                background: "var(--brand)",
                color: "var(--brand-foreground)",
                border: "none",
                opacity: hasInvalidDraft ? 0.5 : 1,
              }}
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDraft("");
              }}
              disabled={updating}
              style={{
                padding: "6px",
                borderRadius: "4px",
                background: "var(--border)",
                border: "none",
              }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
        {hasInvalidDraft && (
          <div style={{ fontSize: "10px", color: "var(--danger)", marginTop: "4px" }}>
            Invalid: {invalidDraft.join(", ")}
          </div>
        )}
      </div>
    );
  }

  const invalidStored =
    validate && value !== "" ? validate(value).length > 0 : false;

  return (
    <div
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title={value || emptyTitle || "Click to edit"}
      style={{
        padding: "6px 8px",
        borderRadius: "6px",
        border: invalidStored ? "1px solid var(--danger)" : "1px solid transparent",
        background: updating ? "var(--muted)" : invalidStored ? "var(--danger-soft)" : "transparent",
        cursor: "pointer",
        fontSize: "12px",
        minHeight: "28px",
        display: "flex",
        alignItems: "center",
      }}
    >
      {updating ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
      {value ? (
        <span
          style={{
            color: invalidStored ? "var(--danger)" : undefined,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
      ) : (
        <span style={{ color: "var(--muted-foreground)" }}>{emptyLabel}</span>
      )}
    </div>
  );
});
