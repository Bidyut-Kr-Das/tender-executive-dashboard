"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { BarChart3, CalendarClock, ExternalLink, FileText, Paperclip, Pencil } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { formatDateTimeIST } from "@/lib/format-ist";
import { cn } from "@/lib/utils";
import { updateTenderMergedField } from "@/lib/slices/tendersSlice";
import { updateCostingItem } from "@/lib/slices/tenderPageSlice";
import { Button, IconButton } from "@/components/v2/ui/button";
import { DatePicker } from "@/components/v2/ui/calendar";
import { CellAction, Clamp } from "@/components/v2/data-table/cells";
import { Badge, Dash, Field, Input, Textarea } from "@/components/v2/ui/field";
import { Dialog, Popover, Select } from "@/components/v2/ui/overlay";
import { toastError } from "@/components/v2/ui/errors";
import {
  FILE_AUTH,
  FileRow,
  TenderSummary,
  fileTags,
  type TenderFile,
} from "@/components/v2/tenders/cells";
import { useTenderCellContext } from "@/components/v2/tenders/use-tenders";
import { FIELDS, dateKey, fieldValue, type FieldDef, type Row } from "./fields";
import { say } from "@/lib/pip-says";

const withAuth = (path: string) => `${path}?auth=${encodeURIComponent(FILE_AUTH)}`;

const LINK = "inline-flex items-center gap-1.5 text-accent-ink underline-offset-2 hover:underline";

export function parseFiles(row: Row): TenderFile[] {
  try {
    const parsed = row.tenderFiles ? JSON.parse(row.tenderFiles) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const taggedFile = (row: Row, tag: string) =>
  parseFiles(row).find((f) => fileTags(f).includes(tag));

/* ------------------------------ Field editors ------------------------------ */

/** Saves one registry field; resolves true when the value was written. */
function useFieldSave(field: FieldDef, row: Row) {
  const dispatch = useAppDispatch();
  const { associations, onFieldSaved } = useTenderCellContext();
  const [pending, setPending] = useState(false);

  const save = (value: string): Promise<boolean> => {
    const problem = field.locked?.(row) ?? field.validate?.(value);
    if (problem) {
      toast.error(say.notSaved(field.label), { description: problem });
      return Promise.resolve(false);
    }
    setPending(true);
    return field
      .save({ dispatch, associations }, row, value)
      .then(() => {
        toast.success(say.updated(field.label));
        onFieldSaved?.();
        return true;
      })
      .catch((err: unknown) => {
        toastError(say.notSaved(field.label), err);
        return false;
      })
      .finally(() => setPending(false));
  };

  return { pending, save };
}

interface EditorProps {
  field: FieldDef;
  row: Row;
  /** Always-open control for the docket sheet; a table cell opens on demand. */
  form?: boolean;
  /** Shown as plain text: the page has no editable column for this field. */
  readOnly?: boolean;
}

function TextEditor({ field, row, form }: EditorProps) {
  const { pending, save } = useFieldSave(field, row);
  const value = fieldValue(field, row);
  const shown = field.display ? field.display(value) : value;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const Control = field.kind === "textarea" ? Textarea : Input;

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    if (next === value) return setDraft(value);
    save(next).then((ok) => {
      if (!ok) setDraft(value);
    });
  };

  if (!form && !editing) {
    return (
      <CellAction
        pending={pending}
        action={
          <IconButton size="sm" label={`Edit ${field.label}`} onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
          </IconButton>
        }
      >
        {shown ? <Clamp>{shown}</Clamp> : <Dash />}
      </CellAction>
    );
  }

  return (
    <Control
      aria-label={field.label}
      autoFocus={!form}
      rows={form ? 3 : 2}
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

function SelectEditor({ field, row, form }: EditorProps) {
  const { pending, save } = useFieldSave(field, row);
  const value = fieldValue(field, row);
  const listed = field.options ?? [];
  // An older value outside the list stays visible until it is replaced.
  const options =
    !value || listed.some((o) => o.value === value)
      ? listed
      : [{ value, label: value }, ...listed];
  return (
    <Select
      size={form ? "md" : "sm"}
      label={field.label}
      placeholder="Not set"
      value={value || null}
      disabled={pending}
      options={field.required ? options : [{ value: CLEAR, label: "Not set" }, ...options]}
      onChange={(picked) => {
        const next = !picked || picked === CLEAR ? "" : picked;
        if (next !== value) save(next);
      }}
    />
  );
}

function YesNoEditor({ field, row }: EditorProps) {
  const { pending, save } = useFieldSave(field, row);
  const tokens = field.tokens ?? { yes: "true", no: "false", none: "" };
  // Shown the moment it is pressed; reverts if the server refuses.
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const value = optimistic ?? fieldValue(field, row);
  const locked = field.locked?.(row) ?? null;

  const choose = (token: string) => {
    const next = value === token ? tokens.none : token;
    if (locked) return void toast.error(say.cantChange(field.label), { description: locked });
    setOptimistic(next);
    save(next).finally(() => setOptimistic(null));
  };

  const option = (token: string, yes: boolean) => {
    const on = value === token;
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${field.label} ${yes ? "yes" : "no"}`}
        disabled={pending}
        onClick={() => choose(token)}
        className={cn(
          "press h-6 w-7 rounded-[0.3125rem] text-xs font-semibold disabled:cursor-progress",
          on
            ? yes
              ? "bg-good text-white dark:text-black"
              : "bg-bad text-white dark:text-black"
            : "not-disabled:hover:bg-hover text-ink-3",
        )}
      >
        {yes ? "Y" : "N"}
      </button>
    );
  };

  return (
    <div
      title={locked ?? undefined}
      className={cn(
        "inline-flex w-fit gap-0.5 rounded-md bg-sunken p-0.5",
        (pending || locked) && "opacity-60",
      )}
    >
      {option(tokens.yes, true)}
      {option(tokens.no, false)}
    </div>
  );
}

function DateEditor({ field, row, form }: EditorProps) {
  const { pending, save } = useFieldSave(field, row);
  const value = fieldValue(field, row);
  const current = dateKey(value);
  return (
    <DatePicker
      label={field.label}
      value={current}
      // A value in no known date format stays readable until a day is picked.
      placeholder={value || "Not set"}
      disabled={pending}
      className={form ? undefined : "h-7 px-2 text-xs"}
      onChange={(next) => {
        if (next !== current) save(next);
      }}
    />
  );
}

/** `dd-MM-yyyy HH:mm` in IST, split into the picker's date and time parts. */
function splitDateTime(iso: string) {
  const shown = formatDateTimeIST(iso);
  const m = shown.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2})$/);
  return { shown, date: m ? `${m[3]}-${m[2]}-${m[1]}` : "", time: m ? m[4] : "" };
}

function DateTimeEditor({ field, row, form }: EditorProps) {
  const { pending, save } = useFieldSave(field, row);
  const current = splitDateTime(fieldValue(field, row));
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current.date);
  const [time, setTime] = useState(current.time);

  const commit = (nextDate: string, nextTime: string) => {
    setOpen(false);
    if (nextDate === current.date && (nextTime || "00:00") === (current.time || "00:00")) return;
    save(nextDate ? `${nextDate}T${nextTime || "00:00"}:00` : "");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDate(current.date);
          setTime(current.time);
        }
        setOpen(next);
      }}
      trigger={
        <button
          type="button"
          aria-label={field.label}
          disabled={pending}
          className={cn(
            "press edge not-disabled:hover:bg-hover flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-surface text-left text-ink disabled:opacity-50",
            form ? "h-8 px-2.5 text-md" : "h-7 px-2 text-xs",
          )}
        >
          <span
            className={cn("min-w-0 flex-1 truncate tabular-nums", !current.shown && "text-ink-3")}
          >
            {current.shown || "Not set"}
          </span>
          <CalendarClock className="size-3.5 shrink-0 text-ink-3" aria-hidden />
        </button>
      }
    >
      <div className="flex w-72 flex-col gap-3">
        <h3 className="font-semibold">{field.label}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <DatePicker value={date} onChange={setDate} placeholder="No date" />
          </Field>
          <Field label="Time (IST)">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          {current.date && (
            <Button variant="ghost" onClick={() => commit("", "")}>
              Clear
            </Button>
          )}
          <Button variant="primary" disabled={!date} onClick={() => commit(date, time)}>
            Save {field.label.toLowerCase()}
          </Button>
        </div>
      </div>
    </Popover>
  );
}

/** A field the page does not let this row edit. */
function LockedField({ field, row }: EditorProps) {
  let value = fieldValue(field, row);
  if (field.kind === "yesNo") {
    if (value === field.tokens?.yes) return <Badge tone="good">Yes</Badge>;
    if (value === field.tokens?.no) return <Badge tone="bad">No</Badge>;
    return <Dash />;
  }
  if (field.display) value = field.display(value) ?? "";
  if (!value) return <Dash />;
  if (field.kind === "dateTime") {
    return <span className="tabular-nums">{formatDateTimeIST(value)}</span>;
  }
  if (field.kind === "date" && dateKey(value)) {
    return <span className="tabular-nums">{format(parseISO(dateKey(value)), "d MMM yyyy")}</span>;
  }
  return <Clamp>{field.options?.find((o) => o.value === value)?.label ?? value}</Clamp>;
}

/** The control for one registry field, in a table cell or in the docket sheet. */
export function FieldEditor(props: EditorProps) {
  const { isLocked } = useTenderCellContext();
  if (props.readOnly || isLocked?.(props.field.id, props.row)) return <LockedField {...props} />;
  switch (props.field.kind) {
    case "select":
      return <SelectEditor {...props} />;
    case "yesNo":
      return <YesNoEditor {...props} />;
    case "date":
      return <DateEditor {...props} />;
    case "dateTime":
      return <DateTimeEditor {...props} />;
    default:
      return <TextEditor {...props} />;
  }
}

/* ------------------------------- File cells -------------------------------- */

export function FileLinkCell({ href, children }: { href: string; children: string }) {
  if (!href) return <Dash />;
  return (
    <a
      href={href.startsWith("/api/") ? withAuth(href) : href}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK}
    >
      <FileText className="size-3.5 shrink-0" aria-hidden />
      {children}
    </a>
  );
}

export function FilesCell({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const files = parseFiles(row);
  if (files.length === 0) return <Dash />;
  return (
    <>
      <Button size="sm" icon={<Paperclip className="size-3.5" />} onClick={() => setOpen(true)}>
        {files.length} {files.length === 1 ? "file" : "files"}
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen} title="Tender files" width="38rem">
          <TenderSummary row={row} />
          <ul>
            {files.map((file, i) => (
              <FileRow key={file.id || i} file={file} />
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}

// ponytail: never evicted; one entry per docket seen this session. Add a size cap if it grows.
const chartLookups = new Map<string, Promise<string | null>>();

/** A docket's comparative chart on the file share, for tenders with no tagged file. */
function findChartOnShare(docketNo: string): Promise<string | null> {
  let lookup = chartLookups.get(docketNo);
  if (!lookup) {
    lookup = fetch(`/api/executive-tenders/${docketNo}/files`, {
      headers: { Authorization: FILE_AUTH },
    })
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data: { files?: { filename: string; fileId: string }[] }) => {
        const match = (data.files ?? []).find((f) =>
          /boqcomparativechart|boq_comparative|boq comparative/i.test(f.filename),
        );
        return match?.fileId ?? null;
      })
      .catch(() => null);
    chartLookups.set(docketNo, lookup);
  }
  return lookup;
}

export function ComparativeChartCell({ row }: { row: Row }) {
  const tagged = taggedFile(row, "boqComparativeChart")?.source ?? null;
  const docketNo = (row.docketNo ?? "").trim();
  const [found, setFound] = useState<string | null>(null);

  useEffect(() => {
    if (tagged || !docketNo) return;
    let live = true;
    findChartOnShare(docketNo).then((id) => {
      if (live) setFound(id);
    });
    return () => {
      live = false;
    };
  }, [tagged, docketNo]);

  const fileId = tagged ?? found;
  if (!fileId) return <Dash />;
  return (
    <Button
      size="sm"
      icon={<BarChart3 className="size-3.5" />}
      onClick={() => window.open(withAuth(`/api/executive-files/download/${fileId}`), "_blank")}
    >
      Comparative chart
    </Button>
  );
}

/* ------------------------------ Display cells ------------------------------ */

interface TypeTest {
  itemCode: string;
  testCertificateNo: string;
  testCertificateUrl: string | null;
}

export function parseTypeTests(row: Row): TypeTest[] {
  try {
    const parsed = JSON.parse(row.typeTests || row.typetest || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function TypeTestCell({ row }: { row: Row }) {
  const tests = parseTypeTests(row);
  if (tests.length === 0) return <Dash />;
  return (
    <Clamp className="flex flex-col gap-0.5 text-xs">
      {tests.map((t, i) => (
        <span key={i} className="shrink-0">
          {t.itemCode} –{" "}
          {t.testCertificateUrl ? (
            <a
              href={withAuth(`/api/executive-files/view/${t.testCertificateUrl}`)}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              {t.testCertificateNo}
            </a>
          ) : (
            t.testCertificateNo
          )}
        </span>
      ))}
    </Clamp>
  );
}

export function YesNoBadge({ value }: { value: string | undefined }) {
  if (value === "true" || value === "1") return <Badge tone="warn">Yes</Badge>;
  if (value === "false" || value === "0") return <Badge>No</Badge>;
  return <Dash />;
}

/** Reverse auction answer, with the RA costing sheet when one is attached. */
export function ReverseAuctionCell({ row }: { row: Row }) {
  const sheet = taggedFile(row, "raCostingSheet");
  const href = sheet?.source && sheet.source !== "SHEET_SYNC"
    ? withAuth(`/api/executive-files/view/${sheet.source}`)
    : sheet?.url;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <FieldEditor field={FIELDS.reverseAuctionApplicable} row={row} />
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cn(LINK, "text-xs")}>
          <ExternalLink className="size-3 shrink-0" aria-hidden />
          RA sheet
        </a>
      )}
    </div>
  );
}

/* ------------------------------- ERP items --------------------------------- */

export type RankField =
  | "ourRank"
  | "ourValue"
  | "nameOfRank1"
  | "valueOfRank1"
  | "differenceBetweenRank1"
  | "nameOfRank2"
  | "valueOfRank2"
  | "differenceBetweenRank2";

interface CostingItem extends Partial<Record<RankField, string | null>> {
  id: number;
  proposedErpItemName: string | null;
  proposedErpQuantity?: string | null;
  bomType?: string | null;
  bomCode?: string | null;
}

interface Bom {
  bomType: string;
  bomCode: string;
}

// The row's costingDetails JSON is not patched after a save, so the saved pair
// is kept here for cells that unmount and come back while scrolling.
// ponytail: never evicted; a page refetch brings the same values anyway.
const savedBoms = new Map<number, Bom>();

function ErpItem({ item }: { item: CostingItem }) {
  const name = (item.proposedErpItemName ?? "").trim();
  const bomByItemName = useAppSelector((s) => s.utility.bomByItemName);
  const [bom, setBom] = useState<Bom>(
    () => savedBoms.get(item.id) ?? { bomType: item.bomType ?? "", bomCode: item.bomCode ?? "" },
  );
  const [pending, setPending] = useState(false);

  const options = useMemo(() => {
    const exact = bomByItemName[name];
    if (exact?.length) return exact;
    const lower = name.toLowerCase();
    const key = Object.keys(bomByItemName).find((k) => k.toLowerCase() === lower);
    return key ? bomByItemName[key] : [];
  }, [bomByItemName, name]);

  const codesFor = (type: string) =>
    [
      ...new Set(
        options
          .filter((o) => !type || (o.bomType ?? "").trim() === type)
          .map((o) => o.bomId)
          .filter(Boolean),
      ),
    ].sort();
  const types = [...new Set(options.map((o) => (o.bomType ?? "").trim()).filter(Boolean))].sort();
  const codes = codesFor(bom.bomType);

  const patch = (body: Partial<Record<keyof Bom, string | null>>, label: string) => {
    setPending(true);
    fetch(`/api/costing-sheet-details/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update");
        const next = { bomType: data.data?.bomType ?? "", bomCode: data.data?.bomCode ?? "" };
        savedBoms.set(item.id, next);
        setBom(next);
        toast.success(say.updated(label));
      })
      .catch((err: unknown) => toastError(say.notSaved(label), err))
      .finally(() => setPending(false));
  };

  const toOptions = (values: string[]) => [
    { value: CLEAR, label: "Not set" },
    ...values.map((v) => ({ value: v, label: v })),
  ];
  const picked = (v: string | null) => (!v || v === CLEAR ? "" : v);

  return (
    <div className="flex shrink-0 flex-col gap-1.5 rounded-lg bg-sunken px-2 py-1.5">
      <div className="flex items-baseline gap-2 text-xs font-medium">
        <span className="min-w-0 flex-1 wrap-break-word">{name}</span>
        {item.proposedErpQuantity?.trim() && (
          <span className="shrink-0 tabular-nums text-ink-2" title="Proposed ERP quantity">
            {item.proposedErpQuantity.trim()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Select
          size="sm"
          label={`BOM type for ${name}`}
          placeholder="BOM type"
          value={bom.bomType || null}
          disabled={pending}
          options={toOptions(types)}
          onChange={(v) => {
            const next = picked(v);
            if (next === bom.bomType) return;
            // A code that does not belong to the new type is cleared with it.
            const keep = bom.bomCode && codesFor(next).includes(bom.bomCode);
            patch(
              keep ? { bomType: next || null } : { bomType: next || null, bomCode: null },
              "BOM type",
            );
          }}
        />
        <Select
          size="sm"
          label={`BOM code for ${name}`}
          placeholder={bom.bomType ? "BOM code" : "Type first"}
          value={bom.bomCode || null}
          disabled={pending || (!bom.bomType && codes.length === 0)}
          options={toOptions(codes)}
          onChange={(v) => {
            const next = picked(v);
            if (next !== bom.bomCode) patch({ bomCode: next || null }, "BOM code");
          }}
        />
      </div>
    </div>
  );
}

function parseCostingItems(row: Row): CostingItem[] {
  try {
    const parsed = JSON.parse(row.costingDetails || "[]");
    return Array.isArray(parsed)
      ? (parsed as CostingItem[]).filter((c) => (c.proposedErpItemName ?? "").trim())
      : [];
  } catch {
    return [];
  }
}

/** One block per costing line: the proposed ERP item with its BOM type and code. */
export function ErpItemsCell({ row }: { row: Row }) {
  const items = parseCostingItems(row);
  if (items.length === 0) return <Dash />;
  return (
    <div className="flex h-full flex-col">
      <Clamp lines="fill" className="flex flex-col gap-1.5">
        {items.map((item) => (
          <ErpItem key={item.id} item={item} />
        ))}
      </Clamp>
    </div>
  );
}

/* ------------------------------ Item-wise rank ----------------------------- */

export const itemWise = (row: Row) => row.itemWiseRankEnabled === "true";

// The differences are computed by the server, so the dialog does not edit them.
const ITEM_RANK_INPUTS: [RankField, string][] = [
  ["ourRank", "Our rank"],
  ["ourValue", "Our value"],
  ["nameOfRank1", "L1 party name"],
  ["valueOfRank1", "L1 price"],
  ["nameOfRank2", "L2 party name"],
  ["valueOfRank2", "L2 price"],
];

type ItemDraft = Partial<Record<RankField, string>>;

const draftOf = (item: CostingItem): ItemDraft =>
  Object.fromEntries(ITEM_RANK_INPUTS.map(([id]) => [id, item[id] ?? ""]));

export type RankPart = "our" | "L1" | "L2";

/** One item's figures for a part, set parts only, joined on one line. */
function itemRankLine(item: CostingItem, part: RankPart): string {
  const parts =
    part === "our"
      ? [item.ourRank?.trim() ? `Our rank ${item.ourRank.trim()}` : "", item.ourValue]
      : part === "L1"
        ? [item.nameOfRank1, item.valueOfRank1, item.differenceBetweenRank1]
        : [item.nameOfRank2, item.valueOfRank2, item.differenceBetweenRank2];
  return parts.map((p) => p?.trim()).filter(Boolean).join(" · ");
}

/** Every costing item with its figures for one part of the result. Needs a flex column parent. */
function ItemRankSummary({ row, part }: { row: Row; part: RankPart }) {
  const items = parseCostingItems(row);
  if (items.length === 0) return <Dash />;
  return (
    <Clamp lines="fill" className="flex flex-col gap-1.5">
      {items.map((item) => {
        const line = itemRankLine(item, part);
        return (
          <div key={item.id} className="flex shrink-0 flex-col">
            <span className="font-medium wrap-break-word">
              {(item.proposedErpItemName ?? "").trim()}
            </span>
            {line ? (
              <span className="text-xs text-ink-2 tabular-nums wrap-break-word">{line}</span>
            ) : (
              <Dash />
            )}
          </div>
        );
      })}
    </Clamp>
  );
}

/** L1 or L2 of an item-wise tender: each item's party, price and difference. */
export function ItemRankCell({ row, part }: { row: Row; part: "L1" | "L2" }) {
  return (
    <div className="flex h-full flex-col">
      <ItemRankSummary row={row} part={part} />
    </div>
  );
}

/** The item-wise switch over our figures per item, with the editor for every item's ranks. */
export function ItemWiseRankCell({ row }: { row: Row }) {
  const dispatch = useAppDispatch();
  const { isLocked } = useTenderCellContext();
  const items = parseCostingItems(row);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, ItemDraft>>({});
  const [saving, setSaving] = useState(false);
  const formId = useId();
  const locked = isLocked?.("ourRank", row) ?? false;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const writes = items
      .map((item) => {
        const old = draftOf(item);
        const patch = Object.fromEntries(
          ITEM_RANK_INPUTS.map(([id]) => [id, (drafts[item.id]?.[id] ?? "").trim()]).filter(
            ([id, value]) => value !== old[id as RankField],
          ),
        );
        return { costingId: item.id, patch };
      })
      .filter((w) => Object.keys(w.patch).length > 0);
    setSaving(true);
    try {
      for (const write of writes) {
        await dispatch(updateCostingItem({ tenderMergedId: Number(row.id), ...write })).unwrap();
      }
      if (writes.length > 0) toast.success(say.updated("the item ranks"));
      setOpen(false);
    } catch (err) {
      toastError(say.notSaved("the item ranks"), err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldEditor field={FIELDS.itemWiseRankEnabled} row={row} />
        {itemWise(row) && items.length > 0 && !locked && (
          <IconButton
            size="sm"
            label="Edit item ranks"
            onClick={() => {
              setDrafts(Object.fromEntries(items.map((item) => [item.id, draftOf(item)])));
              setOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </IconButton>
        )}
      </div>
      {itemWise(row) && <ItemRankSummary row={row} part="our" />}
      {open && (
        <Dialog
          open
          onOpenChange={setOpen}
          title="Edit item ranks"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" loading={saving}>
                Save item ranks
              </Button>
            </>
          }
        >
          <TenderSummary row={row} />
          <form id={formId} onSubmit={save} className="flex flex-col gap-3">
            {items.map((item, i) => {
              const name = (item.proposedErpItemName ?? "").trim();
              return (
                <section key={item.id} className="flex flex-col gap-3 border-b pb-3 last:border-b-0">
                  <h3 className="font-semibold">{name}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ITEM_RANK_INPUTS.map(([id, label], j) => (
                      <Field key={id} label={label}>
                        <Input
                          autoFocus={i === 0 && j === 0}
                          aria-label={`${label} for ${name}`}
                          value={drafts[item.id]?.[id] ?? ""}
                          onChange={(e) =>
                            setDrafts({
                              ...drafts,
                              [item.id]: { ...drafts[item.id], [id]: e.target.value },
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </section>
              );
            })}
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* --------------------------------- Office ---------------------------------- */

export function OfficeCell({ row }: { row: Row }) {
  const dispatch = useAppDispatch();
  const office = row.officeName ?? "";
  const consignees = row.consigneesReportingOfficer ?? "";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ office, consignees });
  const [saving, setSaving] = useState(false);
  const formId = useId();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const writes = [
      ["officeName", draft.office.trim(), office],
      ["consigneesReportingOfficer", draft.consignees.trim(), consignees],
    ].filter(([, next, old]) => next !== old);
    setSaving(true);
    try {
      for (const [field, value, oldValue] of writes) {
        await dispatch(
          updateTenderMergedField({
            rowIndex: 0,
            field,
            value,
            tenderMergedId: Number(row.id),
            oldValue,
          }),
        ).unwrap();
      }
      if (writes.length > 0) toast.success(say.updated("the office details"));
      setOpen(false);
    } catch (err) {
      toastError(say.notSaved("the office details"), err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CellAction
        action={
          <IconButton
            size="sm"
            label="Edit office details"
            onClick={() => {
              setDraft({ office, consignees });
              setOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </IconButton>
        }
      >
        {office || consignees ? (
          <div className="flex flex-col">
            <Clamp lines={2} className="shrink-0 font-medium">
              {office || "–"}
            </Clamp>
            {consignees && (
              <Clamp lines={2} className="shrink-0 text-xs text-ink-2">
                {consignees}
              </Clamp>
            )}
          </div>
        ) : (
          <Dash />
        )}
      </CellAction>
      {open && (
        <Dialog
          open
          onOpenChange={setOpen}
          title="Edit office details"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" loading={saving}>
                Save office details
              </Button>
            </>
          }
        >
          <TenderSummary row={row} />
          <form id={formId} onSubmit={save} className="flex flex-col gap-3">
            <Field label="Office name">
              <Input
                autoFocus
                value={draft.office}
                onChange={(e) => setDraft({ ...draft, office: e.target.value })}
              />
            </Field>
            <Field label="Consignees reporting officer">
              <Textarea
                rows={3}
                value={draft.consignees}
                onChange={(e) => setDraft({ ...draft, consignees: e.target.value })}
              />
            </Field>
          </form>
        </Dialog>
      )}
    </>
  );
}
