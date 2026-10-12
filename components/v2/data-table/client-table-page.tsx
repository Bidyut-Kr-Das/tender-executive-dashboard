"use client";

import type { ReactNode } from "react";
import { Page, PageHeader, PageSkeleton } from "@/components/v2/ui/page";
import { DataTable } from "./data-table";
import type { DataTableColumn } from "./types";
import { useClientTable, type ClientTableOptions } from "./use-client-table";

/**
 * A whole page for rows held in the browser: header, optional strip, table.
 * A page that needs the filtered rows (totals, export) calls `useClientTable`
 * itself instead.
 */
export function ClientTablePage<Row>({
  title,
  noun,
  rows,
  columns,
  getRowId,
  groupBy,
  loading = false,
  error,
  onRetry,
  actions,
  children,
  ...options
}: {
  title: string;
  noun: string;
  rows: Row[];
  /** Keep the identity stable (module constant or memo). */
  columns: DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  groupBy?: (row: Row) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Header buttons. */
  actions?: ReactNode;
  /** Strip between the header and the table. */
  children?: ReactNode;
} & ClientTableOptions<Row>) {
  const { table } = useClientTable(rows, columns, options);

  if (loading && rows.length === 0) return <PageSkeleton label={noun} />;

  return (
    <Page>
      <PageHeader
        title={title}
        meta={`${table.total.toLocaleString("en-IN")} matching`}
        actions={actions}
      />
      {children}
      <DataTable<Row>
        noun={noun}
        columns={columns}
        getRowId={getRowId}
        groupBy={groupBy}
        loading={loading}
        error={error}
        onRetry={onRetry}
        {...table}
      />
    </Page>
  );
}
