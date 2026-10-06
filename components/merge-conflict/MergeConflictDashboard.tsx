"use client";

import React, { useMemo, useCallback, useState } from "react";
import { Eye } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import type { TenderMergedRow } from "@/lib/slices/tendersSlice";
import {
  OptimizedTenderTable,
  ColumnDef,
} from "@/components/tender-viewer/optimized-tender-table/OptimizedTenderTable";
import ConflictDetailsDialog from "./ConflictDetailsDialog";
import { computeConflicts } from "./conflictUtils";

export default function MergeConflictDashboard() {
  const tenderData = useAppSelector((s) => s.tenders.data);
  const loadingTenders = useAppSelector((s) => s.tenders.loading);

  const [approvedState, setApprovedState] = useState<Record<string, string>>(
    {},
  );

  const [selectedDocket, setSelectedDocket] = useState<string | null>(null);

  const groupedRows = useMemo(() => {
    if (!tenderData) return [];

    const groups = new Map<string, TenderMergedRow[]>();
    for (const row of tenderData.rows) {
      const docket = String(row.docketNo ?? "").trim();
      if (!docket) continue;
      const arr = groups.get(docket) ?? [];
      arr.push(row);
      groups.set(docket, arr);
    }

    return Array.from(groups.entries())
      .filter(([_, rows]) => rows.length > 1)
      .map(([docket, rows]) => ({
        docketNo: docket,
        organization: [
          ...new Set(
            rows.map((r) => String(r.organization ?? "")).filter(Boolean),
          ),
        ].join(", "),
        referenceNo: rows
          .map((r) => String(r.referenceNo ?? ""))
          .filter(Boolean)
          .join(" @ "),
        tenderBrief: rows
          .map((r) => String(r.tenderBrief ?? ""))
          .filter(Boolean)
          .join(" @ "),
        _docketTenderCount: rows.length,
        _conflicts: String(computeConflicts(rows).length),
        _rows: rows,
      }));
  }, [tenderData]);

  const handleFilteredRowsChange = useCallback(
    (_rows: Record<string, unknown>[]) => {},
    [],
  );

  const handleApprovedClick = useCallback(
    (docket: string, value: string) => {
      setApprovedState((prev) => {
        const current = prev[docket] ?? "";
        const newValue = current === value ? "" : value;
        return { ...prev, [docket]: newValue };
      });
    },
    [],
  );

  const columnDefs = useMemo(
    (): ColumnDef<Record<string, unknown>>[] => [
      {
        header: "Docket No",
        accessor: "docketNo" as keyof Record<string, unknown>,
        defaultWidth: 180,
        sortable: true,
        filter: { type: "text" as const },
      },
      {
        header: "Organization",
        accessor: "organization" as keyof Record<string, unknown>,
        defaultWidth: 300,
        sortable: true,
        filter: { type: "text" as const },
      },
      {
        header: "Reference No",
        accessor: "referenceNo" as keyof Record<string, unknown>,
        defaultWidth: 350,
        sortable: true,
        filter: { type: "text" as const },
      },
      {
        header: "Tender Brief",
        accessor: "tenderBrief" as keyof Record<string, unknown>,
        defaultWidth: 500,
        sortable: true,
        filter: { type: "text" as const },
      },
      {
        header: "Tenders in Docket",
        accessor:
          "_docketTenderCount" as keyof Record<string, unknown>,
        defaultWidth: 150,
        align: "center",
        sortable: true,
        filter: {
          type: "select" as const,
          options: [
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4+", label: "4+" },
            { value: "__blank__", label: "Blank" },
          ],
        },
        renderCell: (value: unknown) => {
          const count = Number(value ?? 0);
          return (
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                count > 1
                  ? "bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {count}
            </span>
          );
        },
        sortValue: (value: unknown) => Number(value ?? 0),
      },
      {
        header: "Conflicts",
        accessor: "_conflicts" as keyof Record<string, unknown>,
        defaultWidth: 200,
        align: "center",
        sortable: false,
        searchable: false,
        type: "custom" as const,
        renderCell: (value: unknown, row: Record<string, unknown>) => {
          const count = Number(value ?? 0);
          const docket = String(row.docketNo ?? "");
          return (
            <div className="flex items-center justify-center gap-2 py-1">
              <span
                className={`inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-full text-xs font-bold ${
                  count > 0
                    ? "bg-red-100 dark:bg-red-400/15 text-red-700 dark:text-red-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
              <button
                type="button"
                disabled={count === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDocket(docket);
                }}
                className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-semibold border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </button>
            </div>
          );
        },
      },
      {
        header: "Approved",
        accessor: "_approved" as keyof Record<string, unknown>,
        defaultWidth: 130,
        sortable: false,
        filter: {
          type: "select" as const,
          options: [
            { value: "YES", label: "Yes" },
            { value: "NO", label: "No" },
            { value: "__blank__", label: "Blank" },
          ],
        },
        renderCell: (_value: unknown, row: Record<string, unknown>) => {
          const docket = String(row.docketNo ?? "");
          const val = approvedState[docket] ?? "";
          const isYes = val === "YES";
          const isNo = val === "NO";
          return (
            <div className="flex gap-1 py-1">
              <button
                type="button"
                onClick={() => handleApprovedClick(docket, "YES")}
                className={`w-7 h-7 rounded text-xs font-bold border-2 transition-colors cursor-pointer ${
                  isYes
                    ? "bg-green-500 dark:bg-green-500/80 text-white dark:text-foreground border-green-600 dark:border-green-500/60"
                    : "bg-card text-muted-foreground border-border hover:border-ring"
                }`}
              >
                Y
              </button>
              <button
                type="button"
                onClick={() => handleApprovedClick(docket, "NO")}
                className={`w-7 h-7 rounded text-xs font-bold border-2 transition-colors cursor-pointer ${
                  isNo
                    ? "bg-red-500 dark:bg-red-500/80 text-white dark:text-foreground border-red-600 dark:border-red-500/60"
                    : "bg-card text-muted-foreground border-border hover:border-ring"
                }`}
              >
                N
              </button>
            </div>
          );
        },
      },
    ],
    [approvedState, handleApprovedClick, setSelectedDocket],
  );

  if (loadingTenders && !tenderData) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!tenderData) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground bg-card rounded-sm border border-border">
        No tender data found. Upload files from the Tenders page first.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 overflow-hidden bg-muted">
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-1 overflow-auto p-6">
            <OptimizedTenderTable
              columns={columnDefs}
              rows={groupedRows as Record<string, unknown>[]}
              title="Merge Conflict"
              onFilteredRowsChange={handleFilteredRowsChange}
            />
          </main>
        </div>
      </div>

      {selectedDocket && (
        <ConflictDetailsDialog
          docketNo={selectedDocket}
          onClose={() => setSelectedDocket(null)}
        />
      )}
    </>
  );
}
