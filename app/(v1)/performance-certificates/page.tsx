"use client";

import React, { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  fetchPerformanceCertificates,
  fetchSupplyPartyNames,
  updatePerformanceCertificatePartyName,
  updatePerformanceCertificateField,
  type PerformanceCertificateRow,
} from "@/lib/slices/performanceCertificatesSlice";
import { fetchItems } from "@/lib/slices/itemsSlice";
import {
  OptimizedTenderTable,
  type ColumnDef,
} from "@/components/tender-viewer/optimized-tender-table/OptimizedTenderTable";
import { ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";
import "./performance-certificates.css";

const ACTIVE_TONE: Record<"green" | "amber", string> = {
  green:
    "bg-green-500 text-white border-green-600 dark:bg-green-500/80 dark:text-green-50 dark:border-green-500/25",
  amber:
    "bg-amber-500 text-white border-amber-600 dark:bg-amber-500/80 dark:text-amber-950 dark:border-amber-500/25",
};
const INACTIVE_TONE =
  "bg-card text-muted-foreground border-input hover:border-muted-foreground";

const ToggleCell = React.memo(function ToggleCell({
  value,
  options,
  saving,
  onSelect,
}: {
  value: string | null;
  options: { value: string; label: string; tone: "green" | "amber" }[];
  saving: boolean;
  onSelect: (v: string | null) => void;
}) {
  return (
    <div className="flex gap-1 py-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={saving}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(active ? null : opt.value);
            }}
            className={`h-6 px-2 rounded text-xs font-medium border-2 transition-colors cursor-pointer whitespace-nowrap ${
              saving
                ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border"
                : active
                  ? ACTIVE_TONE[opt.tone]
                  : INACTIVE_TONE
            }`}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : opt.label}
          </button>
        );
      })}
    </div>
  );
});

const PartyNameCell = React.memo(function PartyNameCell({
  value,
  options,
  onSelect,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  onSelect: (v: string | null) => void;
}) {
  return (
    <div className="h-7 overflow-hidden">
      <Combobox
        items={options}
        value={value ?? ""}
        onValueChange={(v: string | null) =>
          onSelect(v === "" || v === null ? null : v)
        }
      >
        <ComboboxInput placeholder="Search party..." className="h-6! text-xs" />
        <ComboboxContent className="rounded-sm!">
          <ComboboxList>
            <ComboboxEmpty>No party found.</ComboboxEmpty>
            {options.map((opt) => (
              <ComboboxItem key={opt.value} value={opt.value}>
                {opt.label}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
});

const ItemScheduleCell = React.memo(function ItemScheduleCell({
  value,
  options,
  saving,
  onSelect,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  saving: boolean;
  onSelect: (values: string[]) => void;
}) {
  const selected = useMemo(
    () =>
      (value ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );
  return (
    <div className="flex flex-col gap-1 py-0.5">
      {selected.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {selected.map((v) => (
            <span key={v} className="perf-cert-chip" title={v}>
              {v}
            </span>
          ))}
        </div>
      )}
      <MultiSelect
        value={selected}
        onChange={onSelect}
        options={options}
        title="Item Schedule"
        placeholder={saving ? "Saving..." : selected.length ? "Edit" : "Add items"}
        searchable
        searchPlaceholder="Search item schedule..."
        showCount={false}
        showSelectedLabels={false}
        includeBlank={false}
        triggerClassName="!h-6 !text-xs !w-full"
      />
    </div>
  );
});

function extensionOf(url: string): string {
  try {
    const pathname = new URL(url, "http://x").pathname;
    const dot = pathname.lastIndexOf(".");
    return dot !== -1 ? pathname.slice(dot).toLowerCase() : "";
  } catch {
    return "";
  }
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);

const UrlCell = React.memo(function UrlCell({
  url,
  active,
  onPreview,
}: {
  url: string;
  active: boolean;
  onPreview: () => void;
}) {
  if (!url) return <span>-</span>;
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        title="Preview"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        className={`inline-flex items-center gap-1 px-2 h-6 rounded border text-xs font-medium cursor-pointer transition-colors ${
          active
            ? "bg-brand text-brand-foreground border-brand"
            : "bg-card text-foreground border-input hover:bg-accent"
        }`}
      >
        <ExternalLink size={14} /> Open
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        className="inline-flex items-center text-brand-ink hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
});

function FilePreview({ url }: { url: string }) {
  const ext = extensionOf(url);
  if (ext === ".pdf") {
    return <iframe src={url} title="Certificate preview" className="perf-cert-preview-frame" />;
  }
  if (IMAGE_EXT.has(ext)) {
    return <img src={url} alt="Certificate" className="perf-cert-preview-image" />;
  }
  return (
    <div className="perf-cert-preview-fallback">
      <p>No inline preview for <code>{ext || "this file"}</code>.</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={14} /> Open in new tab
      </a>
    </div>
  );
}

export default function PerformanceCertificatesPage() {
  const dispatch = useAppDispatch();
  const { rows, loading, error, partyNames, saving } = useAppSelector(
    (s) => s.performanceCertificates,
  );
  const itemRows = useAppSelector((s) => s.items.rows);
  const [preview, setPreview] = React.useState<{ name: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    if (rows.length === 0) dispatch(fetchPerformanceCertificates());
    if (partyNames.length === 0) dispatch(fetchSupplyPartyNames());
    if (itemRows.length === 0) dispatch(fetchItems());
  }, [dispatch, rows.length, partyNames.length, itemRows.length]);

  const partyNameOptions = useMemo(
    () => [
      { value: "", label: "(Blank)" },
      ...partyNames.map((n) => ({ value: n, label: n })),
    ],
    [partyNames],
  );

  const itemScheduleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of itemRows) {
      const v = r.itemSchedule?.trim();
      if (v && !seen.has(v)) seen.set(v, v);
    }
    return [...seen.values()].map((v) => ({ value: v, label: v }));
  }, [itemRows]);

  const utilityOptions = useMemo(
    () =>
      [
        { value: "CLIENT", label: "By Client", tone: "green" as const },
        { value: "UTILITY", label: "By Utility", tone: "amber" as const },
      ],
    [],
  );

  const useOptions = useMemo(
    () =>
      [
        { value: "USE", label: "Use", tone: "green" as const },
        { value: "NOT_USE", label: "Not Use", tone: "amber" as const },
      ],
    [],
  );

  const updateField = React.useCallback(
    (
      id: string,
      field: "utilityOrClient" | "useNotUse" | "itemSchedule",
      value: string | null,
      label: string,
    ) => {
      dispatch(updatePerformanceCertificateField({ id, field, value }))
        .unwrap()
        .then(() => toast.success(value ? `${label} updated` : `${label} cleared`))
        .catch((err: Error) =>
          toast.error(err?.message || `Failed to update ${label}`),
        );
    },
    [dispatch],
  );

  const columns = useMemo<ColumnDef<PerformanceCertificateRow>[]>(
    () => [
      {
        header: "Certificate Name",
        accessor: "certificateName",
        defaultWidth: 180,
        align: "left",
        filter: { type: "select", searchable: true },
      },
      {
        header: "Certificate Link",
        accessor: "certificateUrl",
        defaultWidth: 180,
        align: "center",
        renderCell: (_, row) => (
          <UrlCell
            url={row.certificateUrl ?? ""}
            active={preview?.url === row.certificateUrl}
            onPreview={() =>
              setPreview({
                name: row.certificateName ?? "Certificate",
                url: row.certificateUrl ?? "",
              })
            }
          />
        ),
      },
      {
        header: "Party Name",
        accessor: "partyName",
        defaultWidth: 180,
        align: "left",
        renderCell: (_, row) => (
          <PartyNameCell
            value={row.partyName ?? null}
            options={partyNameOptions}
            onSelect={(v) =>
              dispatch(
                updatePerformanceCertificatePartyName({ id: row.id, partyName: v }),
              )
            }
          />
        ),
        filter: { type: "select", searchable: true },
      },
      {
        header: "Utility / Client",
        accessor: "utilityOrClient",
        defaultWidth: 180,
        align: "left",
        renderCell: (_, row) => (
          <ToggleCell
            value={row.utilityOrClient ?? null}
            options={utilityOptions}
            saving={!!saving[`${row.id}-utilityOrClient`]}
            onSelect={(v) =>
              updateField(row.id, "utilityOrClient", v, "Utility / Client")
            }
          />
        ),
        filter: {
          type: "select",
          searchable: true,
          options: [
            { value: "CLIENT", label: "By Client" },
            { value: "UTILITY", label: "By Utility" },
          ],
        },
      },
      {
        header: "Item Schedule",
        accessor: "itemSchedule",
        defaultWidth: 180,
        align: "left",
        renderCell: (_, row) => (
          <ItemScheduleCell
            value={row.itemSchedule ?? null}
            options={itemScheduleOptions}
            saving={!!saving[`${row.id}-itemSchedule`]}
            onSelect={(vals) =>
              updateField(
                row.id,
                "itemSchedule",
                vals.length ? vals.join(",") : null,
                "Item Schedule",
              )
            }
          />
        ),
        filter: { type: "select", searchable: true },
      },
      {
        header: "Use / Not Use",
        accessor: "useNotUse",
        defaultWidth: 180,
        align: "center",
        renderCell: (_, row) => (
          <ToggleCell
            value={row.useNotUse ?? null}
            options={useOptions}
            saving={!!saving[`${row.id}-useNotUse`]}
            onSelect={(v) => updateField(row.id, "useNotUse", v, "Use / Not Use")}
          />
        ),
        filter: {
          type: "select",
          searchable: true,
          options: [
            { value: "USE", label: "Use" },
            { value: "NOT_USE", label: "Not Use" },
          ],
        },
      },
    ],
    [
      dispatch,
      partyNameOptions,
      utilityOptions,
      useOptions,
      itemScheduleOptions,
      saving,
      updateField,
      preview,
    ],
  );

  return (
    <div className="perf-cert-page flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">
          Performance Certificates
        </h1>
        {!loading && !error && (
          <span className="text-sm text-muted-foreground">{rows.length} rows</span>
        )}
      </div>
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground bg-card">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading certificates...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-12 text-sm text-red-600 dark:text-red-300 bg-card">
          {error}
        </div>
      )}
      {!loading && !error && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <OptimizedTenderTable
              columns={columns}
              rows={rows}
              title="Performance Certificates"
            />
          </div>
          {preview && (
            <div className="perf-cert-preview">
              <div className="perf-cert-preview-header">
                <span title={preview.name}>{preview.name}</span>
                <div className="perf-cert-preview-actions">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in new tab"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    type="button"
                    title="Close preview"
                    onClick={() => setPreview(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="perf-cert-preview-body">
                <FilePreview url={preview.url} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
