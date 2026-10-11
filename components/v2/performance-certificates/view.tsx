"use client";

import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  fetchPerformanceCertificates,
  type PerformanceCertificateRow as Row,
} from "@/lib/slices/performanceCertificatesSlice";
import { dateText } from "@/components/v2/data-table/cells";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn } from "@/components/v2/data-table/types";
import { Dash } from "@/components/v2/ui/field";

const dateTime = (id: "createdAt" | "updatedAt", header: string): DataTableColumn<Row> => ({
  id,
  header,
  width: 170,
  search: false,
  filter: { type: "dateRange" },
  text: (row) => dateText(row[id], "dd/MM/yyyy HH:mm"),
});

const columns: DataTableColumn<Row>[] = [
  { id: "certificateName", header: "Certificate Name", width: 420, filter: selectFilter() },
  {
    id: "certificateUrl",
    header: "Certificate Link",
    width: 160,
    search: false,
    sortable: false,
    cell: (row) =>
      row.certificateUrl ? (
        <a
          href={row.certificateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent-ink hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden /> Open
        </a>
      ) : (
        <Dash />
      ),
  },
  dateTime("createdAt", "Created At"),
  dateTime("updatedAt", "Updated At"),
];

const getRowId = (row: Row) => row.id;

export function PerformanceCertificatesView() {
  const dispatch = useAppDispatch();
  const { rows, loading, error } = useAppSelector((s) => s.performanceCertificates);

  useEffect(() => {
    if (rows.length === 0) dispatch(fetchPerformanceCertificates());
  }, [dispatch, rows.length]);

  return (
    <ClientTablePage
      title="Performance Certificates"
      noun="certificates"
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      loading={loading}
      error={error}
      onRetry={() => dispatch(fetchPerformanceCertificates())}
    />
  );
}
