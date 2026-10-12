"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, RefreshCw, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import type { SupplyHistoryRecord } from "@/types/supplyHistory";
import { DataTable } from "@/components/v2/data-table/data-table";
import type { SortState } from "@/components/v2/data-table/types";
import { useClientTable } from "@/components/v2/data-table/use-client-table";
import { Button } from "@/components/v2/ui/button";
import { describeError, toastError } from "@/components/v2/ui/errors";
import { Menu, MenuItem } from "@/components/v2/ui/overlay";
import { Page, PageHeader, PageSkeleton, StatTile } from "@/components/v2/ui/page";
import {
  FILE_AUTH,
  SupplyContext,
  columns,
  dataColumns,
  formatDate,
  type CertState,
  type EditableField,
  type Row,
} from "./columns";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1tXiJC9AZNiAAoL8mM_KxKuzrFqzuk-n3n16abJbaam0";
const POLL_MS = 30_000;

const defaultSort: SortState = { column: "saleBillDate", direction: "desc" };
const getRowId = (row: Row) => row.key;
const today = () => new Date().toISOString().split("T")[0];

/** Bill and item identify a row; a repeat of the pair is numbered. */
function withKeys(records: SupplyHistoryRecord[]): Row[] {
  const seen = new Map<string, number>();
  return records.map((r) => {
    const base = `${r.saleBillNumber}|${r.itemCode}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...r, key: n ? `${base}#${n}` : base };
  });
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Raw values, so numbers stay numbers in the sheet. */
async function exportExcel(rows: Row[]) {
  // Lazy: the ~400KB writer stays out of the page chunk until someone exports.
  const XLSX = await import("xlsx");
  const data = rows.map((row) =>
    Object.fromEntries(
      dataColumns.map((c) => {
        const value = row[c.id as keyof Row];
        if (c.id === "certificateSentDate") {
          return [c.header, value ? formatDate(value as string) : "Not Sent"];
        }
        return [c.header, value ?? ""];
      }),
    ),
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), "Supply History");
  XLSX.writeFile(book, `Supply_History_Data_${today()}.xlsx`);
}

/** Zips the folder documents of these rows; resolves to how many rows had only online links. */
async function downloadDocuments(rows: Row[]): Promise<number | null> {
  const bills = rows.filter((r) => r.hasDocuments && r.saleBillNumber).map((r) => r.saleBillNumber);
  if (bills.length === 0) return null;
  const res = await fetch("/api/supply-history/download-documents-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: FILE_AUTH },
    body: JSON.stringify({ saleBillNumbers: bills }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Download failed" }));
    throw new Error(err.error || "Download failed");
  }
  download(await res.blob(), `Supply_Documents_${today()}.zip`);
  return rows.filter((r) => !r.hasDocuments && r.attachmentUrl).length;
}

const driveOnlyNotice = (count: number) =>
  count > 0 &&
  toast.info(`${count} record(s) with only Google Drive documents were excluded from the zip`);

/** The page's rows: loaded once, polled every 30 seconds, patched in place after an edit. */
function useSupplyRows() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (fresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (fresh || !loaded.current) setLoading(true);
    try {
      const res = await fetch(`/api/supply-history${fresh ? "?fresh=true" : ""}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Server error (${res.status})`);
      loaded.current = true;
      setRows(withKeys(json.data || []));
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(await describeError(err));
    } finally {
      // A superseded request must not switch off the newer one's progress bar.
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), POLL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { rows, setRows, loading, error, refresh };
}

export function SupplyHistoryView() {
  const { rows, setRows, loading, error, refresh } = useSupplyRows();
  const [certStates, setCertStates] = useState<Record<string, CertState>>({});
  const [busy, setBusy] = useState(false);
  // Read at call time, so a click always acts on the rows now on screen.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const inFlight = useRef(new Set<string>());

  const { table, filtered } = useClientTable(rows, columns, { defaultSort });

  const setCert = (ref: string, state: CertState) =>
    setCertStates((prev) => ({ ...prev, [ref]: state }));

  const saveField = useCallback(
    async (row: Row, field: EditableField, value: string) => {
      const { saleBillNumber, itemCode } = row;
      const res = await fetch("/api/supply-history/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleBillNumber: saleBillNumber ?? "",
          itemCode: itemCode ?? "",
          field,
          value,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Update failed");

      if (field === "email" && Array.isArray(json.updatedEmails)) {
        // An email is saved for the whole party: the server returns every row it touched.
        const emails = new Map<string, string | null>(
          json.updatedEmails.map(
            (u: { saleBillNumber: string; itemCode: string; email?: string | null }) => [
              `${u.saleBillNumber}|${u.itemCode}`,
              u.email ?? null,
            ],
          ),
        );
        setRows((prev) =>
          prev.map((r) => {
            const next = emails.get(`${r.saleBillNumber}|${r.itemCode}`);
            return next === undefined ? r : { ...r, email: next };
          }),
        );
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.saleBillNumber === saleBillNumber && r.itemCode === itemCode
            ? { ...r, [field]: json.data?.[field] ?? value }
            : r,
        ),
      );
    },
    [setRows],
  );

  const generateCertificate = useCallback(
    async (ref: string) => {
      if (inFlight.current.has(ref)) return;
      inFlight.current.add(ref);
      setCert(ref, { status: "generating" });
      try {
        const group = rowsRef.current
          .filter((r) => r.partyRefNo === ref)
          .map(({ key: _key, ...record }) => record);
        const res = await fetch("/api/supply-history/generate-certificate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: group }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          throw new Error(err.error || "Generation failed");
        }
        const driveUrl = res.headers.get("X-Drive-Url") || "";
        const named = (res.headers.get("Content-Disposition") || "").match(/filename="?([^"]+)"?/);
        const fileName = named ? named[1] : `Certificate_${ref || "NAN"}.pdf`;
        download(await res.blob(), fileName);
        setCert(ref, { status: "ready" });
        if (driveUrl) {
          setRows((prev) =>
            prev.map((r) =>
              r.partyRefNo === ref
                ? { ...r, certificateUrl: driveUrl, certificateFileName: fileName }
                : r,
            ),
          );
        }
        toast.success("Certificate generated successfully");
      } catch (err) {
        setCert(ref, { status: "error", error: await describeError(err) });
        toastError("Certificate not generated", err);
      } finally {
        inFlight.current.delete(ref);
      }
    },
    [setRows],
  );

  const sendCertificate = useCallback(
    async (ref: string) => {
      if (inFlight.current.has(ref)) return;
      inFlight.current.add(ref);
      setCert(ref, { status: "emailSending" });
      try {
        const res = await fetch("/api/supply-history/send-certificate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partyRefNo: ref }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to send email");
        setCert(ref, { status: "emailSent" });
        toast.success(
          `Certificate emailed to ${json.to}${json.cc?.length ? ` (cc: ${json.cc.join(", ")})` : ""}`,
        );
        const sentAt: string = json.certificateSentDate ?? new Date().toISOString();
        setRows((prev) =>
          prev.map((r) => (r.partyRefNo === ref ? { ...r, certificateSentDate: sentAt } : r)),
        );
        // "Sent" shows for three seconds, then the buttons come back.
        setTimeout(() => {
          setCertStates((prev) =>
            prev[ref]?.status === "emailSent" ? { ...prev, [ref]: { status: "ready" } } : prev,
          );
        }, 3000);
      } catch (err) {
        setCert(ref, { status: "error", error: await describeError(err) });
        toastError("Email not sent", err);
      } finally {
        inFlight.current.delete(ref);
      }
    },
    [setRows],
  );

  const emailsByRef = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.partyRefNo || !r.email) continue;
      const list = out.get(r.partyRefNo);
      if (list) list.push(r.email);
      else out.set(r.partyRefNo, [r.email]);
    }
    return out;
  }, [rows]);

  const context = useMemo(
    () => ({ saveField, certStates, emailsByRef, generateCertificate, sendCertificate }),
    [saveField, certStates, emailsByRef, generateCertificate, sendCertificate],
  );

  /** One header action at a time; `work` reports its own success. */
  const run = (what: string, work: () => Promise<unknown>) => {
    setBusy(true);
    work()
      .catch((err) => toastError(what, err))
      .finally(() => setBusy(false));
  };

  const scanDocuments = () =>
    run("Scan failed", async () => {
      const json = await (await fetch("/api/supply-indexer", { method: "POST" })).json();
      if (!json.success) throw new Error(json.error);
      await refresh();
      toast.success("Documents scanned successfully");
    });

  const syncQuotation = () =>
    run("Quotation sync failed", async () => {
      const res = await fetch("/api/supply-history/sync-quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: FILE_AUTH },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Sync failed");
      const s = json.stats;
      toast.success(
        `Quotation sync done: ${s?.updated ?? 0} records updated (${s?.totalContracts ?? 0} contracts, ${s?.errors?.length ?? 0} errors)`,
      );
      await refresh();
    });

  const downloadAllDocuments = () =>
    run("Documents not downloaded", async () => {
      const driveOnly = await downloadDocuments(filtered);
      if (driveOnly === null) toast.info("No document records found in current view");
      else driveOnlyNotice(driveOnly);
    });

  const exportAndDownload = () =>
    run("Export failed", async () => {
      // The sheet carries every record; the zip follows the current filters.
      await exportExcel(rows);
      const driveOnly = await downloadDocuments(filtered);
      if (driveOnly === null) toast.info("Excel exported. No documents to zip.");
      else driveOnlyNotice(driveOnly);
    });

  const totals = useMemo(
    () => ({
      amount: filtered.reduce((sum, r) => sum + (r.invoiceAmt || 0), 0),
      quantity: filtered.reduce((sum, r) => sum + (r.invoiceQty || 0), 0),
      withBill: filtered.filter((r) => r.saleBillNumber).length,
    }),
    [filtered],
  );
  const whole = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  if (loading && rows.length === 0) return <PageSkeleton label="supply history" />;

  return (
    <Page>
      <PageHeader
        title="Supply History"
        meta={`${table.total.toLocaleString("en-IN")} matching`}
        actions={
          <>
            <Button icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={refresh}>
              Refresh
            </Button>
            <Menu
              align="end"
              trigger={
                <Button icon={<ScanSearch className="size-3.5" />} loading={busy}>
                  Sync
                </Button>
              }
            >
              <MenuItem onClick={scanDocuments}>Scan documents</MenuItem>
              <MenuItem onClick={syncQuotation}>Sync quotation no</MenuItem>
            </Menu>
            <Menu
              align="end"
              trigger={
                <Button icon={<Download className="size-3.5" />} loading={busy}>
                  Export
                </Button>
              }
            >
              <MenuItem onClick={() => run("Export failed", () => exportExcel(filtered))}>
                Export Excel
              </MenuItem>
              <MenuItem onClick={downloadAllDocuments}>Download all docs</MenuItem>
              <MenuItem onClick={exportAndDownload}>Export and download</MenuItem>
            </Menu>
            <Button
              icon={<ExternalLink className="size-3.5" />}
              onClick={() => window.open(SHEET_URL, "_blank", "noopener,noreferrer")}
            >
              Open sheet
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatTile label="Total records" value={whole(filtered.length)} />
        <StatTile label="Total invoice amt" value={`₹${whole(totals.amount)}`} />
        <StatTile label="Total invoice qty" value={whole(totals.quantity)} />
        <StatTile label="With bill no" value={whole(totals.withBill)} />
      </div>

      <SupplyContext value={context}>
        <DataTable<Row>
          noun="records"
          columns={columns}
          getRowId={getRowId}
          loading={loading}
          error={rows.length === 0 ? error : null}
          onRetry={refresh}
          {...table}
        />
      </SupplyContext>
    </Page>
  );
}
