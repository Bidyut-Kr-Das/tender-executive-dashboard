"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  FileSpreadsheet,
  FileUp,
  Filter,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import { fetchAllFilteredTenderRows } from "@/actions/tender-query";
import { publishAiAnalysisJob } from "@/actions/ai-analysis";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  TENDER_CATEGORIES,
  TENDER_SUBCATEGORIES,
  isValidCategorySelection,
  type TenderCategory,
} from "@/lib/tender-categories";
import type { TenderQuery } from "@/lib/tender-query";
import {
  clearState as clearFilesState,
  resetSelectedDateRange,
  setSelectedDateRange,
} from "@/lib/slices/filesSlice";
import { setExclusionFilter } from "@/lib/slices/filtersSlice";
import {
  addFiles,
  clearFiles,
  clearResults,
  removeFile,
  uploadFiles,
  uploadResultFiles,
} from "@/lib/slices/uploadSlice";
import { Button, IconButton } from "@/components/v2/ui/button";
import { Field, Input } from "@/components/v2/ui/field";
import { Dialog, Menu, MenuItem, MenuSeparator, Popover, Select } from "@/components/v2/ui/overlay";

/* --------------------------------- Uploads --------------------------------- */

type UploadMode = "parse" | "result";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function UploadDialog({ mode, onClose }: { mode: UploadMode; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const pendingFiles = useAppSelector((s) => s.upload.pendingFiles);
  const parsing = useAppSelector((s) => s.upload.parsing);
  const rejectedRows = useAppSelector((s) => s.upload.rejectedRows);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const subCategories = TENDER_SUBCATEGORIES[category as TenderCategory] ?? [];
  const selectionValid = isValidCategorySelection(category, subCategory);

  // Rows the server refused come back as a spreadsheet to fix and re-upload.
  useEffect(() => {
    if (parsing || rejectedRows.length === 0) return;
    const data = rejectedRows.map((r) => ({
      "Source File": r.fileName,
      Sheet: r.sheetName,
      "Rejection Reason": r.reason,
      ...r.row,
    }));
    void import("xlsx").then((XLSX) => {
      const sheet = XLSX.utils.json_to_sheet(data);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Rejected Tenders");
      XLSX.writeFile(book, `rejected-tenders-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.error(`${rejectedRows.length} tender(s) rejected`, {
        description: "Downloaded rejected-tenders excel",
      });
    });
  }, [parsing, rejectedRows]);

  useEffect(
    () => () => {
      dispatch(clearFiles());
      dispatch(clearResults());
      // Back to the default upload window, so fresh uploads are in view.
      dispatch(clearFilesState());
    },
    [dispatch],
  );

  const submit = () => {
    if (pendingFiles.length === 0) return;
    if (mode === "result") {
      dispatch(uploadResultFiles(pendingFiles));
    } else if (selectionValid) {
      dispatch(uploadFiles({ files: pendingFiles, category, subCategory: subCategory || null }));
    }
  };

  const count = pendingFiles.length;
  const noun = `${count} file${count === 1 ? "" : "s"}`;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={mode === "parse" ? "Upload tenders" : "Upload result"}
      description="Excel files, .xlsx or .xls"
      width="36rem"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            loading={parsing}
            disabled={count === 0 || (mode === "parse" && !selectionValid)}
            onClick={submit}
          >
            {mode === "parse" ? `Parse ${noun}` : `Upload result for ${noun}`}
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.xls"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.length) dispatch(addFiles(e.target.files));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) dispatch(addFiles(e.dataTransfer.files));
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-8 text-ink-2 transition-colors duration-150",
          dragOver ? "border-accent bg-accent-soft text-accent-ink" : "hover-bg border-line-strong",
        )}
      >
        <FileUp className="size-5" aria-hidden />
        <span>{dragOver ? "Drop files to add them" : "Choose files or drag them here"}</span>
      </button>

      {count > 0 && (
        <ul className="mt-3 flex flex-col">
          {pendingFiles.map((file, i) => (
            <li key={file.name + file.size} className="flex items-center gap-2 border-b py-1.5 last:border-b-0">
              <FileSpreadsheet className="size-4 shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-3">
                {formatFileSize(file.size)}
              </span>
              <IconButton size="sm" label={`Remove ${file.name}`} onClick={() => dispatch(removeFile(i))}>
                <X className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {mode === "parse" && count > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Category">
            <Select
              label="Category"
              placeholder="Select category"
              value={category || null}
              disabled={parsing}
              onChange={(v) => {
                setCategory(v ?? "");
                setSubCategory("");
              }}
              options={Object.values(TENDER_CATEGORIES).map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Subcategory">
            <Select
              label="Subcategory"
              placeholder={subCategories.length ? "Select subcategory" : "None for this category"}
              value={subCategory || null}
              disabled={parsing || subCategories.length === 0}
              onChange={(v) => setSubCategory(v ?? "")}
              options={subCategories.map((s) => ({ value: s, label: s }))}
            />
          </Field>
        </div>
      )}
    </Dialog>
  );
}

export function UploadMenu() {
  const [mode, setMode] = useState<UploadMode | null>(null);
  return (
    <>
      <Menu align="end" trigger={<Button icon={<Upload className="size-3.5" />}>Upload</Button>}>
        <MenuItem icon={<FileUp />} onClick={() => setMode("parse")}>
          Tender files
        </MenuItem>
        <MenuItem icon={<FileSpreadsheet />} onClick={() => setMode("result")}>
          Result files
        </MenuItem>
      </Menu>
      {mode && <UploadDialog mode={mode} onClose={() => setMode(null)} />}
    </>
  );
}

/* -------------------------------- AI analysis ------------------------------ */

export function AiAnalysisButton({ query, total }: { query: TenderQuery; total: number }) {
  const [open, setOpen] = useState(false);
  const [reRunAll, setReRunAll] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const abort = useRef(false);

  const run = async () => {
    abort.current = false;
    setOpen(false);
    setProgress({ done: 0, total: 0 });
    const toastId = toast.loading("Collecting filtered tenders...");

    try {
      // Every row the filters match, not only the visible page.
      const rows = await fetchAllFilteredTenderRows(query, [
        "tenderBrief",
        "itemCategory",
        "aiRelevanceValid",
        "referenceNo",
      ]);
      const targets = rows.filter((r) => {
        const brief = String(r.tenderBrief ?? "");
        if (!brief || brief === "—") return false;
        if (!r.referenceNo) return false;
        return reRunAll || !r.aiRelevanceValid;
      });

      if (targets.length === 0) {
        toast.info(
          "Nothing to queue: every filtered tender already has an AI result or has no tender brief",
          { id: toastId },
        );
        return;
      }

      setProgress({ done: 0, total: targets.length });
      let queued = 0;
      let failed = 0;
      for (const row of targets) {
        if (abort.current) break;
        try {
          const sent = await publishAiAnalysisJob({
            referenceNo: String(row.referenceNo ?? ""),
            tenderBrief: String(row.tenderBrief ?? ""),
            itemCategory: String(row.itemCategory ?? ""),
          });
          if (sent) queued++;
          else failed++;
        } catch {
          failed++;
        }
        toast.loading(`Queueing tenders for AI analysis (${queued + failed}/${targets.length})`, {
          id: toastId,
        });
        setProgress({ done: queued + failed, total: targets.length });
      }

      if (abort.current) toast.info(`Stopped. ${queued} queued`, { id: toastId });
      else if (failed === 0) toast.success(`${queued} tender(s) queued for AI analysis`, { id: toastId });
      else toast.warning(`${queued} queued, ${failed} failed`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI analysis could not start", {
        id: toastId,
      });
    } finally {
      setProgress(null);
    }
  };

  if (progress) {
    return (
      <Button
        variant="danger"
        icon={<Square className="size-3 fill-current" />}
        onClick={() => {
          abort.current = true;
        }}
      >
        Stop
        <span className="tabular-nums">
          {progress.done}/{progress.total}
        </span>
      </Button>
    );
  }

  return (
    <>
      <Button icon={<Sparkles className="size-3.5" />} onClick={() => setOpen(true)}>
        AI analysis
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Run AI analysis"
        description={`Queues the ${total.toLocaleString("en-IN")} tenders matching the current filters. Results arrive as each one is analysed.`}
        width="28rem"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={run}>
              Queue analysis
            </Button>
          </>
        }
      >
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-3.5 accent-(--accent)"
            checked={reRunAll}
            onChange={(e) => setReRunAll(e.target.checked)}
          />
          Also re-analyse tenders that already have a result
        </label>
      </Dialog>
    </>
  );
}

/* -------------------------------- Exclusions ------------------------------- */

export const EXCLUSION_OPTIONS = [
  { value: "cable", label: "Exclude cables" },
  { value: "conductors", label: "Exclude conductors" },
  { value: "both", label: "Exclude both" },
];

export function ExclusionsMenu() {
  const dispatch = useAppDispatch();
  const current = useAppSelector((s) => s.filters.exclusionFilter);
  return (
    <Menu align="end" trigger={<Button icon={<Filter className="size-3.5" />}>Exclusions</Button>}>
      {EXCLUSION_OPTIONS.map((opt) => (
        <MenuItem
          key={opt.value}
          icon={current === opt.value ? <Check /> : <span className="block size-3.5" />}
          onClick={() => dispatch(setExclusionFilter(current === opt.value ? null : opt.value))}
        >
          {opt.label}
        </MenuItem>
      ))}
      {current && (
        <>
          <MenuSeparator />
          <MenuItem onClick={() => dispatch(setExclusionFilter(null))}>Clear exclusion</MenuItem>
        </>
      )}
    </Menu>
  );
}

/* ------------------------------- Upload window ----------------------------- */

const toInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd") : "");
const fromInput = (value: string) => new Date(`${value}T00:00:00`).toISOString();

export function formatUploadWindow(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  return `${format(new Date(from), "d MMM yyyy")} – ${format(new Date(to), "d MMM yyyy")}`;
}

export function UploadWindowControl() {
  const dispatch = useAppDispatch();
  const from = useAppSelector((s) => s.files.selectedDateFrom);
  const to = useAppSelector((s) => s.files.selectedDateTo);
  const [draft, setDraft] = useState({ from: toInput(from), to: toInput(to) });

  useEffect(() => setDraft({ from: toInput(from), to: toInput(to) }), [from, to]);

  // The window only applies with both ends set.
  const update = (next: { from: string; to: string }) => {
    setDraft(next);
    if (next.from && next.to) {
      dispatch(setSelectedDateRange({ from: fromInput(next.from), to: fromInput(next.to) }));
    }
  };

  return (
    <Popover
      trigger={
        <Button icon={<CalendarDays className="size-3.5" />}>
          <span className="text-ink-3">Uploaded</span>
          {formatUploadWindow(from, to) ?? "Any time"}
        </Button>
      }
    >
      <div className="flex w-72 flex-col gap-3">
        <h3 className="font-semibold">Upload date</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <Input
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => update({ ...draft, from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => update({ ...draft, to: e.target.value })}
            />
          </Field>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          disabled={!from && !to}
          onClick={() => dispatch(resetSelectedDateRange())}
        >
          Show files from any time
        </Button>
      </div>
    </Popover>
  );
}
