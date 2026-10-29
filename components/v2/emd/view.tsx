"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { fetchEmdMerged } from "@/lib/slices/emdSlice";
import { DataTable } from "@/components/v2/data-table/data-table";
import { exportRows } from "@/components/v2/data-table/export";
import type { FilterChip } from "@/components/v2/data-table/types";
import { useClientTable } from "@/components/v2/data-table/use-client-table";
import { Button } from "@/components/v2/ui/button";
import { describeError } from "@/components/v2/ui/errors";
import { Menu, MenuItem } from "@/components/v2/ui/overlay";
import { Page, PageHeader, PageSkeleton, StatTile } from "@/components/v2/ui/page";
import { columns, parseAmount, values, type Row } from "./columns";
import { say } from "@/lib/pip-says";

const BUCKETS = ["REFUNDED", "PENDING", "WRITTEN OFF"] as const;
type Bucket = (typeof BUCKETS)[number];
const BUCKET_LABELS: Record<Bucket, string> = {
  REFUNDED: "Refunded",
  PENDING: "Pending",
  "WRITTEN OFF": "Written off",
};

function bucketOf(row: Row): Bucket | null {
  const status = row.statusRefundedPending?.trim().toUpperCase();
  if (status === "REFUNDED" || status === "PENDING") return status;
  if (status === "WRITTEN OFF" || status === "WRITTENOFF" || status === "WRITTEN-OFF") {
    return "WRITTEN OFF";
  }
  return null;
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const getRowId = (row: Row) => row.id;
const exportColumns = columns.filter((c) => c.id !== "action");

export function EmdView() {
  const dispatch = useAppDispatch();
  const { data, loading, refreshing, error } = useAppSelector((s) => s.emd);
  const [bucket, setBucket] = useState<Bucket | null>(null);

  useEffect(() => {
    const promise = dispatch(fetchEmdMerged());
    // Leaving the page drops a response nobody is waiting for.
    return () => promise.abort();
  }, [dispatch]);

  const stats = useMemo(() => {
    const out = Object.fromEntries(
      BUCKETS.map((b) => [b, { count: 0, total: 0, customers: new Set<string>() }]),
    ) as Record<Bucket, { count: number; total: number; customers: Set<string> }>;
    for (const row of data) {
      const key = bucketOf(row);
      if (!key) continue;
      out[key].count += 1;
      out[key].total += parseAmount(row.emdAmt);
      if (row.customerName) out[key].customers.add(row.customerName.trim().toLowerCase());
    }
    return out;
  }, [data]);

  const inBucket = useMemo(
    () => (bucket ? data.filter((row) => bucketOf(row) === bucket) : data),
    [data, bucket],
  );
  const { table, filtered } = useClientTable(inBucket, columns, { values });

  const extraChips = useMemo<FilterChip[]>(
    () =>
      bucket
        ? [{ key: "bucket", label: BUCKET_LABELS[bucket], onRemove: () => setBucket(null) }]
        : [],
    [bucket],
  );

  const exportAs = (extension: "xlsx" | "csv") => {
    const name = `EMD_Merged_${new Date().toISOString().slice(0, 10)}.${extension}`;
    toast.promise(exportRows(filtered, exportColumns, name, "EMD Merged"), {
      loading: say.exporting(),
      success: (n) => say.exported(n, "record"),
      error: async (err) => `${say.couldNot("export them")} ${await describeError(err)}`,
    });
  };

  if (loading && data.length === 0) return <PageSkeleton label="EMD" />;

  return (
    <Page>
      <PageHeader
        title="EMD Merged"
        meta={`${table.total.toLocaleString("en-IN")} matching`}
        actions={
          <>
            <Button
              icon={<RefreshCw className="size-3.5" />}
              loading={refreshing}
              onClick={() => dispatch(fetchEmdMerged({ force: true }))}
            >
              Refresh
            </Button>
            <Menu align="end" trigger={<Button icon={<Download className="size-3.5" />}>Export</Button>}>
              <MenuItem onClick={() => exportAs("xlsx")}>Excel (.xlsx)</MenuItem>
              <MenuItem onClick={() => exportAs("csv")}>CSV (.csv)</MenuItem>
            </Menu>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {BUCKETS.map((b) => (
          <StatTile
            key={b}
            label={BUCKET_LABELS[b]}
            detail={`${stats[b].count.toLocaleString("en-IN")} EMDs, ${stats[b].customers.size} customers`}
            value={rupees(stats[b].total)}
            selected={bucket === b}
            onClick={() => setBucket(bucket === b ? null : b)}
          />
        ))}
      </div>

      <DataTable<Row>
        noun="records"
        columns={columns}
        getRowId={getRowId}
        loading={loading || refreshing}
        error={data.length === 0 ? error : null}
        onRetry={() => dispatch(fetchEmdMerged({ force: true }))}
        extraChips={extraChips}
        {...table}
      />
    </Page>
  );
}
