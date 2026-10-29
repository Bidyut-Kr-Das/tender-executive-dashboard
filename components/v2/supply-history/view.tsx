"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, RefreshCw, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSupplyFacet,
  fetchSupplyPage,
  fetchSupplyRows,
  syncSupplySheet,
} from "@/actions/supply-history";
import { DataTable } from "@/components/v2/data-table/data-table";
import type {
  ColumnFilterState,
  ColumnFilterType,
  FilterOption,
  SortState,
} from "@/components/v2/data-table/types";
import { nextFilters } from "@/components/v2/data-table/use-client-table";
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
import { say } from "@/lib/pip-says";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1tXiJC9AZNiAAoL8mM_KxKuzrFqzuk-n3n16abJbaam0";

const defaultSort: SortState = { column: "saleBillDate", direction: "desc" };
const getRowId = (row: Row) => row.key;
const today = () => new Date().toISOString().split("T")[0];

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
  toast.info(say.driveOnlyLeftOut(count));

const NO_TOTALS = { amount: 0, quantity: 0, withBill: 0 };
const NO_OPTIONS = { options: null, loading: false } as const;

type Facet = { options: FilterOption[] | null; loading: boolean; key: string };

/**
 * One page of rows: the server filters, sorts and pages, like the tenders
 * page. Patched in place after an edit.
 */
function useSupplyTable() {
  const [filters, setFilters] = useState<Record<string, ColumnFilterState>>({});
  const [sort, setSort] = useState<SortState | null>(defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [columnVisibility, onColumnVisibilityChange] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState(NO_TOTALS);
  const [emailsByRef, setEmailsByRef] = useState(new Map<string, string[]>());
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<Record<string, Facet>>({});
  const facetsRef = useRef(facets);
  facetsRef.current = facets;
  // Server actions cannot be aborted; only the newest answer is applied.
  const latest = useRef(0);

  const reload = useCallback(
    async () => {
      const id = ++latest.current;
      setLoading(true);
      try {
        const res = await fetchSupplyPage({ filters, sort, page, pageSize });
        if (id !== latest.current) return;
        setRows(res.rows);
        setTotal(res.total);
        setTotals(res.totals);
        setEmailsByRef(new Map(Object.entries(res.emailsByRef)));
        setError(null);
        setLoaded(true);
      } catch (err) {
        if (id !== latest.current) return;
        setError(await describeError(err));
      } finally {
        if (id === latest.current) setLoading(false);
      }
    },
    [filters, sort, page, pageSize],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // Same as the tenders page: options load when a panel opens, under every
  // other active filter, and again once those filters change.
  const onFilterOpen = useCallback(
    (column: string) => {
      if (columns.find((c) => c.id === column)?.filter?.type !== "select") return;
      const key = JSON.stringify(filters);
      const entry = facetsRef.current[column];
      if (entry?.key === key && (entry.loading || entry.options)) return;
      setFacets((prev) => ({
        ...prev,
        [column]: { options: prev[column]?.options ?? null, loading: true, key },
      }));
      fetchSupplyFacet(filters, column)
        .then((res) => res.options.map((value) => ({ value, label: value })))
        .catch(() => null)
        .then((options) =>
          setFacets((prev) =>
            prev[column]?.key === key ? { ...prev, [column]: { options, loading: false, key } } : prev,
          ),
        );
    },
    [filters],
  );

  const getFilterOptions = useCallback(
    (column: string) => facets[column] ?? NO_OPTIONS,
    [facets],
  );

  const onFilterChange = useCallback(
    (columnId: string, type: ColumnFilterType, value: unknown | undefined) => {
      setFilters((prev) => nextFilters(prev, columnId, type, value));
      setPage(1);
    },
    [],
  );

  return {
    rows,
    setRows,
    totals,
    emailsByRef,
    setEmailsByRef,
    filters,
    sort,
    loading,
    loaded,
    error,
    setLoading,
    reload,
    table: {
      rows,
      total,
      page,
      pageSize,
      onPageChange: setPage,
      onPageSizeChange: useCallback((size: number) => {
        setPageSize(size);
        setPage(1);
      }, []),
      sort,
      onSortChange: useCallback((next: SortState) => {
        setSort(next);
        setPage(1);
      }, []),
      filters,
      onFilterChange,
      onResetFilters: useCallback(() => {
        setFilters({});
        setPage(1);
      }, []),
      getFilterOptions,
      onFilterOpen,
      columnVisibility,
      onColumnVisibilityChange,
    },
  };
}

export function SupplyHistoryView() {
  const {
    rows,
    setRows,
    totals,
    emailsByRef,
    setEmailsByRef,
    filters,
    sort,
    loading,
    loaded,
    error,
    setLoading,
    reload,
    table,
  } = useSupplyTable();
  const [certStates, setCertStates] = useState<Record<string, CertState>>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(new Set<string>());

  /** Pulls the Google Sheet into the database, then reloads the page. */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await syncSupplySheet();
    } catch (err) {
      toastError(say.couldNot("sync the sheet"), err);
    }
    await reload();
  }, [reload, setLoading]);

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
        const updated: {
          saleBillNumber: string;
          itemCode: string;
          partyRefNo?: string | null;
          email?: string | null;
        }[] = json.updatedEmails;
        const emails = new Map(updated.map((u) => [`${u.saleBillNumber}|${u.itemCode}`, u.email ?? null]));
        setRows((prev) =>
          prev.map((r) => {
            const next = emails.get(`${r.saleBillNumber}|${r.itemCode}`);
            return next === undefined ? r : { ...r, email: next };
          }),
        );
        // ponytail: assumes a party ref's rows all share one party name, so the
        // server's list holds every row of each ref it names.
        setEmailsByRef((prev) => {
          const byRef = new Map<string, string[]>();
          for (const u of updated) {
            if (!u.partyRefNo) continue;
            const list = byRef.get(u.partyRefNo) ?? [];
            if (u.email) list.push(u.email);
            byRef.set(u.partyRefNo, list);
          }
          return new Map([...prev, ...byRef]);
        });
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
    [setRows, setEmailsByRef],
  );

  const generateCertificate = useCallback(
    async (ref: string) => {
      if (inFlight.current.has(ref)) return;
      inFlight.current.add(ref);
      setCert(ref, { status: "generating" });
      try {
        // The ref's rows can sit on other pages.
        const group = (await fetchSupplyRows({ partyRefNo: { select: [ref.trim()] } }, null)).map(
          ({ key: _key, ...record }) => record,
        );
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
        toast.success(say.generated("the certificate"));
      } catch (err) {
        setCert(ref, { status: "error", error: await describeError(err) });
        toastError(say.couldNot("generate the certificate"), err);
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
        toast.success(say.certificateEmailed(json.to, json.cc));
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
        toastError(say.couldNot("send the email"), err);
      } finally {
        inFlight.current.delete(ref);
      }
    },
    [setRows],
  );

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
    run(say.couldNot("scan the documents"), async () => {
      const json = await (await fetch("/api/supply-indexer", { method: "POST" })).json();
      if (!json.success) throw new Error(json.error);
      await reload();
      toast.success(say.documentsScanned());
    });

  const syncQuotation = () =>
    run(say.couldNot("sync quotations"), async () => {
      const res = await fetch("/api/supply-history/sync-quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: FILE_AUTH },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Sync failed");
      const s = json.stats;
      toast.success(say.quotationsSynced(s?.updated ?? 0, s?.totalContracts ?? 0, s?.errors?.length ?? 0));
      await reload();
    });

  // Exports cover every matching row, not just this page.
  const filtered = () => fetchSupplyRows(filters, sort);

  const downloadAllDocuments = () =>
    run(say.couldNot("download the documents"), async () => {
      const driveOnly = await downloadDocuments(await filtered());
      if (driveOnly === null) toast.info(say.noDocumentsHere());
      else driveOnlyNotice(driveOnly);
    });

  const exportAndDownload = () =>
    run(say.couldNot("export them"), async () => {
      // The sheet carries every record; the zip follows the current filters.
      await exportExcel(await fetchSupplyRows({}, null));
      const driveOnly = await downloadDocuments(await filtered());
      if (driveOnly === null) toast.info(say.excelNoDocuments());
      else driveOnlyNotice(driveOnly);
    });

  const whole = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  if (!loaded && loading) return <PageSkeleton label="supply history" />;

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
              <MenuItem onClick={() => run(say.couldNot("export them"), async () => exportExcel(await filtered()))}>
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
        <StatTile label="Total records" value={whole(table.total)} />
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
          onRetry={reload}
          {...table}
        />
      </SupplyContext>
    </Page>
  );
}
