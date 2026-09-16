"use client";

import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { fetchRailways, type RailwayRow } from "@/lib/slices/railwaysSlice";
import {
  OptimizedTenderTable,
  type ColumnDef,
} from "@/components/tender-viewer/optimized-tender-table/OptimizedTenderTable";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const fmtDate = (v: unknown): string => {
  if (v == null || v === "") return "-";
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? "-" : format(d, "dd/MM/yyyy");
};

const dateCell = (v: unknown) => <span>{fmtDate(v)}</span>;

const columns: ColumnDef<RailwayRow>[] = [
  { header: "Financial Year", accessor: "financialYear", defaultWidth: 120, align: "left" },
  { header: "Railway", accessor: "railway", defaultWidth: 160, align: "left" },
  { header: "Tender No.", accessor: "tenderNo", defaultWidth: 110, align: "left" },
  { header: "ERP Tender No", accessor: "erpTenderNo", defaultWidth: 130, align: "left" },
  { header: "QTN No", accessor: "qtnNo", defaultWidth: 120, align: "left" },
  { header: "Due Date", accessor: "dueDate", defaultWidth: 120, align: "center", renderCell: dateCell },
  { header: "ERP Item Schedule", accessor: "erpItemSchedule", defaultWidth: 160, align: "left" },
  { header: "ERP Code", accessor: "erpCode", defaultWidth: 120, align: "left" },
  { header: "Item", accessor: "item", defaultWidth: 240, align: "left" },
  { header: "Qty (Kms)", accessor: "qtyInKms", defaultWidth: 100, align: "right", type: "number" },
  { header: "Participated", accessor: "participated", defaultWidth: 110, align: "center" },
  { header: "Reverse Auction", accessor: "reverseAuction", defaultWidth: 130, align: "center" },
  { header: "Bid Opened", accessor: "bidOpened", defaultWidth: 110, align: "center" },
  { header: "RA Done", accessor: "reverseAuctionDone", defaultWidth: 130, align: "center" },
  { header: "Comparative Available", accessor: "comparativeAvailable", defaultWidth: 150, align: "center" },
  { header: "RA Announced", accessor: "raAnnounced", defaultWidth: 120, align: "center" },
  { header: "RA Announced On", accessor: "raAnnouncedOnDate", defaultWidth: 130, align: "center", renderCell: dateCell },
  { header: "Expected Contract Status", accessor: "expectedContractStatus", defaultWidth: 170, align: "left" },
];

export default function RailwaysPage() {
  const dispatch = useAppDispatch();
  const { rows, loading, error } = useAppSelector((s) => s.railways);

  useEffect(() => {
    dispatch(fetchRailways());
  }, [dispatch]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <h1 className="text-lg font-semibold text-slate-800">Railways Register</h1>
        {!loading && !error && <span className="text-sm text-slate-500">{rows.length} rows</span>}
      </div>
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400 bg-white">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading railways...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-12 text-sm text-red-600 bg-white">
          {error}
        </div>
      )}
      {!loading && !error && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <OptimizedTenderTable
            columns={columns}
            rows={rows}
            title="Railways Register"
          />
        </div>
      )}
    </div>
  );
}