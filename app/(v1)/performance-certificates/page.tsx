"use client";

import React, { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  fetchPerformanceCertificates,
  type PerformanceCertificateRow,
} from "@/lib/slices/performanceCertificatesSlice";
import {
  OptimizedTenderTable,
  type ColumnDef,
} from "@/components/tender-viewer/optimized-tender-table/OptimizedTenderTable";
import { format } from "date-fns";
import { ExternalLink, Loader2 } from "lucide-react";

const fmtDate = (v: unknown): string => {
  if (v == null || v === "") return "-";
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? "-" : format(d, "dd/MM/yyyy HH:mm");
};

const dateCell = (v: unknown) => <span>{fmtDate(v)}</span>;

const urlCell = (v: unknown) => {
  const url = typeof v === "string" ? v : "";
  if (!url) return <span>-</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-ink hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink size={14} /> Open
    </a>
  );
};

export default function PerformanceCertificatesPage() {
  const dispatch = useAppDispatch();
  const { rows, loading, error } = useAppSelector(
    (s) => s.performanceCertificates,
  );

  useEffect(() => {
    if (rows.length === 0) dispatch(fetchPerformanceCertificates());
  }, [dispatch, rows.length]);

  const columns = useMemo<ColumnDef<PerformanceCertificateRow>[]>(
    () => [
      {
        header: "Certificate Name",
        accessor: "certificateName",
        defaultWidth: 360,
        align: "left",
        filter: { type: "select", searchable: true },
      },
      {
        header: "Certificate Link",
        accessor: "certificateUrl",
        defaultWidth: 160,
        align: "center",
        renderCell: urlCell,
      },
      {
        header: "Created At",
        accessor: "createdAt",
        defaultWidth: 160,
        align: "center",
        renderCell: dateCell,
        filter: { type: "dateRange" },
      },
      {
        header: "Updated At",
        accessor: "updatedAt",
        defaultWidth: 160,
        align: "center",
        renderCell: dateCell,
        filter: { type: "dateRange" },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
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
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <OptimizedTenderTable
            columns={columns}
            rows={rows}
            title="Performance Certificates"
          />
        </div>
      )}
    </div>
  );
}
