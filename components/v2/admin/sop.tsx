"use client";

import { useMemo, useState } from "react";
import { Plus, Rows3, X } from "lucide-react";
import { toast } from "sonner";
import { StackedCell } from "@/components/v2/data-table/cells";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn } from "@/components/v2/data-table/types";
import { Button, IconButton } from "@/components/v2/ui/button";
import { DatePicker } from "@/components/v2/ui/calendar";
import { Badge, Checkbox, Dash, Field, Input, Textarea, type Tone } from "@/components/v2/ui/field";
import { Select } from "@/components/v2/ui/overlay";
import { FormDialog, RowActions, request, useRows } from "./shared";

interface SopRow {
  id: number;
  columnName: string;
  description: string | null;
  allocatedTo: string | null;
  email: string | null;
  dailyLog: string | null;
  date: string | null;
  source: string | null;
  doneFromWhere: string | null;
  isManual: boolean;
  dailyLogEnabled: boolean;
  dateEnabled: boolean;
}

/** One responsibility as the form holds it: every text field a string. */
interface Draft {
  columnName: string;
  description: string;
  allocatedTo: string;
  email: string;
  dailyLog: string;
  date: string;
  source: string;
  doneFromWhere: string;
  isManual: boolean;
  dailyLogEnabled: boolean;
  dateEnabled: boolean;
}

type BulkDraft = Draft & { key: number; errors?: Record<string, string> };

const ENDPOINT = "/api/sop-responsibilities";
const SOURCES = [
  "MANUAL",
  "UPLOAD_EXCEL",
  "SCRAPE_247",
  "AI",
  "DOCUMENT_PARSE",
  "RA_AUTOMATION",
  "GOOGLE_SHEET_SYNC",
  "SYSTEM",
];
const SOURCE_OPTIONS = SOURCES.map((s) => ({ value: s, label: s }));
/** Filled by automation, so there is no daily tick or date to keep. */
const AUTOMATED = new Set(["AI", "DOCUMENT_PARSE", "RA_AUTOMATION", "SCRAPE_247"]);
const SOURCE_TONES: Record<string, Tone> = { MANUAL: "accent", AI: "warn" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const BLANK: Draft = {
  columnName: "",
  description: "",
  allocatedTo: "",
  email: "",
  dailyLog: "",
  date: "",
  source: "",
  doneFromWhere: "",
  isManual: false,
  dailyLogEnabled: true,
  dateEnabled: true,
};

let nextKey = 1;
const blankBulk = (): BulkDraft => ({ ...BLANK, key: nextKey++ });
const threeBlank = () => ({ drafts: [blankBulk(), blankBulk(), blankBulk()] });

const TEXT_FIELDS = [
  "columnName",
  "description",
  "allocatedTo",
  "email",
  "dailyLog",
  "date",
  "source",
  "doneFromWhere",
] as const;
const hasText = (d: Draft) => TEXT_FIELDS.some((f) => d[f].trim());

const toBody = (d: Draft) => ({
  columnName: d.columnName.trim(),
  description: d.description.trim() || null,
  allocatedTo: d.allocatedTo.trim() || null,
  email: d.email.trim() || null,
  dailyLog: d.dailyLog.trim() || null,
  date: d.date.trim() || null,
  source: d.source.trim() || null,
  doneFromWhere: d.doneFromWhere.trim() || null,
  isManual: d.isManual,
  dailyLogEnabled: d.dailyLogEnabled,
  dateEnabled: d.dateEnabled,
});

function toDraft(row: SopRow): Draft {
  let date = "";
  if (row.date && !Number.isNaN(new Date(row.date).getTime())) {
    const iso = String(row.date).slice(0, 10);
    date = DAY.test(iso) ? iso : "";
  }
  return {
    columnName: row.columnName || "",
    description: row.description || "",
    allocatedTo: row.allocatedTo || "",
    email: row.email || "",
    dailyLog: row.dailyLog || "",
    date,
    source: row.source || "",
    doneFromWhere: row.doneFromWhere || "",
    isManual: !!row.isManual,
    dailyLogEnabled: row.dailyLogEnabled ?? true,
    dateEnabled: row.dateEnabled ?? true,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

const trackingText = (r: SopRow) =>
  [r.dailyLogEnabled && "Log", r.dateEnabled && "Date"].filter(Boolean).join(" ") ||
  "false/false (AI/parse)";

const load = async () => (await request<{ data: SopRow[] }>(ENDPOINT)).data;
const getRowId = (row: SopRow) => String(row.id);

function validateBulk(drafts: BulkDraft[]) {
  const errors: Record<number, Record<string, string>> = {};
  const fail = (d: BulkDraft, field: string, message: string) => {
    (errors[d.key] ??= {})[field] = message;
  };
  for (const d of drafts) {
    if (!hasText(d)) continue;
    if (!d.columnName.trim()) fail(d, "columnName", "Required");
    if (d.email.trim() && !EMAIL.test(d.email.trim())) fail(d, "email", "Invalid email");
    if (d.date.trim() && !DAY.test(d.date.trim())) fail(d, "date", "Invalid date");
    if (d.source.trim() && !SOURCES.includes(d.source.trim().toUpperCase())) {
      fail(d, "source", "Invalid source");
    }
  }
  return errors;
}

function BulkGrid({
  drafts,
  onChange,
}: {
  drafts: BulkDraft[];
  onChange: (drafts: BulkDraft[]) => void;
}) {
  const patch = (key: number, change: Partial<Draft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...change, errors: undefined } : d)));

  const text = (d: BulkDraft, field: (typeof TEXT_FIELDS)[number], label: string) => (
    <td className="p-1 align-top">
      <Input
        aria-label={label}
        aria-invalid={!!d.errors?.[field]}
        className={d.errors?.[field] ? "outline-2 outline-bad" : undefined}
        value={d[field]}
        onChange={(e) => patch(d.key, { [field]: e.target.value })}
      />
      {d.errors?.[field] && <p className="px-1 text-xs text-bad">{d.errors[field]}</p>}
    </td>
  );

  const tick = (d: BulkDraft, field: "isManual" | "dailyLogEnabled" | "dateEnabled", label: string) => (
    <td className="p-1 pt-2.5 align-top">
      <Checkbox checked={d[field]} onChange={(on) => patch(d.key, { [field]: on })}>
        <span className="sr-only">{label}</span>
      </Checkbox>
    </td>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[78rem] border-collapse">
        <thead>
          <tr className="type-label text-left text-ink-3">
            <th className="min-w-40 p-1 font-medium">Column name (required)</th>
            <th className="min-w-44 p-1 font-medium">Description</th>
            <th className="min-w-32 p-1 font-medium">Allocated to</th>
            <th className="min-w-40 p-1 font-medium">Email</th>
            <th className="min-w-40 p-1 font-medium">Source</th>
            <th className="min-w-40 p-1 font-medium">Done from where</th>
            <th className="p-1 font-medium">Manual?</th>
            <th className="p-1 font-medium">DailyLog</th>
            <th className="p-1 font-medium">Date</th>
            <th className="min-w-36 p-1 font-medium">Date value</th>
            <th className="w-8 p-1" />
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => (
            <tr key={d.key}>
              {text(d, "columnName", "Column name")}
              {text(d, "description", "Description")}
              {text(d, "allocatedTo", "Allocated to")}
              {text(d, "email", "Email")}
              <td className="p-1 align-top">
                <Select
                  label="Source"
                  placeholder="Not set"
                  value={d.source || null}
                  options={SOURCE_OPTIONS}
                  onChange={(next) => {
                    const source = next ?? "";
                    const automated = AUTOMATED.has(source);
                    patch(d.key, {
                      source,
                      dailyLogEnabled: automated ? false : d.dailyLogEnabled,
                      dateEnabled: automated ? false : d.dateEnabled,
                      isManual: source === "MANUAL",
                    });
                  }}
                />
                {d.errors?.source && <p className="px-1 text-xs text-bad">{d.errors.source}</p>}
              </td>
              {text(d, "doneFromWhere", "Done from where")}
              {tick(d, "isManual", "Manual")}
              {tick(d, "dailyLogEnabled", "Daily log")}
              {tick(d, "dateEnabled", "Date")}
              <td className="p-1 align-top">
                <DatePicker
                  label="Date value"
                  placeholder="No date"
                  value={d.date}
                  onChange={(date) => patch(d.key, { date })}
                />
                {d.errors?.date && <p className="px-1 text-xs text-bad">{d.errors.date}</p>}
              </td>
              <td className="p-1 pt-2 align-top">
                <IconButton
                  size="sm"
                  label="Remove row"
                  disabled={drafts.length <= 1}
                  onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
                >
                  <X className="size-3.5" />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SopResponsibilitiesView() {
  const t = useRows(load);
  const [editing, setEditing] = useState<SopRow | "new" | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  // Made once per open, so reopening starts from three empty rows.
  const [bulkInitial, setBulkInitial] = useState(threeBlank);

  const { remove, upsert } = t;
  const columns = useMemo<DataTableColumn<SopRow>[]>(
    () => [
      { id: "columnName", header: "Column Name", width: 220, filter: selectFilter() },
      { id: "description", header: "Description", width: 280, filter: selectFilter(), text: (r) => r.description ?? "" },
      { id: "doneFromWhere", header: "Done From Where", width: 220, filter: selectFilter(), text: (r) => r.doneFromWhere ?? "" },
      {
        id: "source",
        header: "Source",
        width: 160,
        filter: selectFilter(),
        text: (r) => r.source ?? "",
        cell: (r) => (r.source ? <Badge tone={SOURCE_TONES[r.source] ?? "neutral"}>{r.source}</Badge> : <Dash />),
      },
      {
        id: "isManual",
        header: "Manual?",
        width: 110,
        search: false,
        filter: { type: "boolean" },
        text: (r) => (r.isManual ? "Yes" : "No"),
      },
      {
        id: "allocatedTo",
        header: "Allocated To",
        width: 220,
        filter: selectFilter(),
        text: (r) => r.allocatedTo ?? "",
        cell: (r) => <StackedCell primary={r.allocatedTo ?? ""} secondary={r.email ?? undefined} />,
      },
      {
        id: "tracking",
        header: "DailyLog/Date",
        width: 190,
        sortable: false,
        text: trackingText,
        cell: (r) => <StackedCell primary={trackingText(r)} secondary={formatDate(r.date)} />,
      },
      {
        id: "actions",
        header: "Actions",
        width: 100,
        search: false,
        sortable: false,
        cell: (row) => (
          <RowActions
            what={`SOP entry "${row.columnName}"`}
            onEdit={() => setEditing(row)}
            onDelete={() => request(`${ENDPOINT}/${row.id}`, "DELETE").then(() => remove(row.id))}
          />
        ),
      },
    ],
    [remove],
  );

  const row = editing && editing !== "new" ? editing : null;
  const initial = useMemo(() => (row ? toDraft(row) : BLANK), [row]);

  const save = async (draft: Draft) => {
    if (!draft.columnName.trim()) throw new Error("Column Name is required");
    if (draft.email.trim() && !EMAIL.test(draft.email.trim())) throw new Error("Invalid email");
    if (draft.date && !DAY.test(draft.date)) throw new Error("Invalid date");
    const body = { ...toBody(draft), date: draft.date || null };
    const { data } = row
      ? await request<{ data: SopRow }>(`${ENDPOINT}/${row.id}`, "PATCH", body)
      : await request<{ data: SopRow }>(ENDPOINT, "POST", body);
    upsert(data);
    toast.success(row ? "Updated" : "Created");
  };

  const openBulk = () => {
    setBulkInitial(threeBlank());
    setBulkOpen(true);
  };

  return (
    <>
      <ClientTablePage
        title="SOP Responsibilities"
        noun="entries"
        rows={t.rows}
        columns={columns}
        getRowId={getRowId}
        loading={t.loading}
        error={t.error}
        onRetry={t.reload}
        actions={
          <>
            <Button icon={<Rows3 className="size-3.5" />} onClick={openBulk}>
              Bulk add
            </Button>
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEditing("new")}>
              Add single
            </Button>
          </>
        }
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={row ? "Edit SOP responsibility" : "Add SOP responsibility"}
        width="38rem"
        initial={initial}
        onSubmit={save}
      >
        {(draft, set) => (
          <>
            <Field label="Column name">
              <Input
                autoFocus
                placeholder="e.g. Tender Uploading"
                value={draft.columnName}
                onChange={(e) => set({ columnName: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                placeholder="Description of SOP"
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Allocated to">
                <Input
                  placeholder="e.g. Arpan Pal"
                  value={draft.allocatedTo}
                  onChange={(e) => set({ allocatedTo: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  placeholder="e.g. sales@uicwires.com"
                  value={draft.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Daily log">
              <Textarea
                rows={2}
                placeholder="Daily log note (optional)"
                value={draft.dailyLog}
                onChange={(e) => set({ dailyLog: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Source">
                <Select
                  label="Source"
                  placeholder="Select source"
                  value={draft.source || null}
                  options={SOURCE_OPTIONS}
                  onChange={(next) => {
                    const source = next ?? "";
                    set(
                      AUTOMATED.has(source)
                        ? { source, dailyLogEnabled: false, dateEnabled: false }
                        : { source },
                    );
                  }}
                />
              </Field>
              <Field label="Date">
                <DatePicker placeholder="No date" value={draft.date} onChange={(date) => set({ date })} />
              </Field>
            </div>
            <Field label="Done from where">
              <Input
                placeholder="e.g. Excel upload / Manual via TenderTable"
                value={draft.doneFromWhere}
                onChange={(e) => set({ doneFromWhere: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Checkbox checked={draft.isManual} onChange={(isManual) => set({ isManual })}>
                Manual?
              </Checkbox>
              <Checkbox checked={draft.dailyLogEnabled} onChange={(dailyLogEnabled) => set({ dailyLogEnabled })}>
                DailyLog
              </Checkbox>
              <Checkbox checked={draft.dateEnabled} onChange={(dateEnabled) => set({ dateEnabled })}>
                Date
              </Checkbox>
            </div>
          </>
        )}
      </FormDialog>

      <FormDialog<{ drafts: BulkDraft[] }>
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk add SOP responsibilities"
        description="Column name is required. Empty rows are ignored. An automated source (AI, document parse, RA automation, scrape) switches DailyLog and Date off; both can be switched back on."
        width="84rem"
        initial={bulkInitial}
        submitLabel={({ drafts }) => `Save all (${drafts.filter((d) => d.columnName.trim()).length})`}
        extraActions={({ drafts }, setValue) => (
          <>
            <Button icon={<Plus className="size-3.5" />} onClick={() => setValue({ drafts: [...drafts, blankBulk()] })}>
              Add row
            </Button>
            <Button onClick={() => setValue(threeBlank())}>Clear</Button>
          </>
        )}
        onSubmit={async ({ drafts }, setValue) => {
          const filled = drafts.filter(hasText);
          if (filled.length === 0) throw new Error("Add at least one row with Column Name");
          const errors = validateBulk(drafts);
          const first = Object.values(errors)[0];
          if (first) {
            setValue({ drafts: drafts.map((d) => ({ ...d, errors: errors[d.key] })) });
            throw new Error(Object.values(first)[0]);
          }
          const result = await request<{
            data: SopRow[];
            created?: number;
            errors?: { index: number; field: string; message: string }[];
          }>(`${ENDPOINT}/bulk`, "POST", { rows: filled.map(toBody) });
          upsert(...(result.data ?? []));
          const created = result.created ?? 0;
          const failed = result.errors ?? [];
          if (failed.length > 0) {
            const byKey: Record<number, Record<string, string>> = {};
            for (const e of failed) {
              const key = filled[e.index]?.key;
              if (key != null) (byKey[key] ??= {})[e.field] = e.message;
            }
            // Only the refused rows stay: saving again must not create the others twice.
            setValue({
              drafts: drafts.filter((d) => byKey[d.key]).map((d) => ({ ...d, errors: byKey[d.key] })),
            });
            throw new Error(`${created} created, ${failed.length} rows failed`);
          }
          toast.success(`${created} SOP rows created`);
        }}
      >
        {({ drafts }, set) => <BulkGrid drafts={drafts} onChange={(next) => set({ drafts: next })} />}
      </FormDialog>
    </>
  );
}
