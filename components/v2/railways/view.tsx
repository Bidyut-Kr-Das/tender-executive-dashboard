"use client";

import { useEffect, useState } from "react";
import { createSelector } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import type { RootState } from "@/lib/store";
import { fetchItems } from "@/lib/slices/itemsSlice";
import {
  fetchRailways,
  updateRailwaysErpCode,
  type RailwayRow as Row,
} from "@/lib/slices/railwaysSlice";
import { dateText } from "@/components/v2/data-table/cells";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn } from "@/components/v2/data-table/types";
import { toastError } from "@/components/v2/ui/errors";
import { Combobox } from "@/components/v2/ui/overlay";
import { say } from "@/lib/pip-says";

const selectItemCodes = createSelector(
  (s: RootState) => s.items.rows,
  (rows) => rows.map((r) => ({ value: r.itemcode, label: r.itemcode })),
);

function ErpCodeCell({ row }: { row: Row }) {
  const dispatch = useAppDispatch();
  const options = useAppSelector(selectItemCodes);
  const [pending, setPending] = useState(false);

  const save = (erpCode: string | null) => {
    setPending(true);
    dispatch(updateRailwaysErpCode({ id: row.id, erpCode }))
      .unwrap()
      .then(() => toast.success(erpCode ? say.set("the ERP code", erpCode) : say.cleared("the ERP code")))
      .catch((err) => toastError(say.notSaved("the ERP code"), err))
      .finally(() => setPending(false));
  };

  return (
    <Combobox
      size="sm"
      label="ERP code"
      placeholder="Not set"
      value={row.erpCode ?? null}
      onChange={save}
      options={options}
      disabled={pending}
    />
  );
}

const text = (id: string, header: string, width: number): DataTableColumn<Row> => ({
  id,
  header,
  width,
  filter: selectFilter(),
});

const date = (id: "dueDate" | "raAnnouncedOnDate", header: string): DataTableColumn<Row> => ({
  id,
  header,
  width: 140,
  search: false,
  filter: { type: "dateRange" },
  text: (row) => dateText(row[id]),
});

const columns: DataTableColumn<Row>[] = [
  text("financialYear", "Financial Year", 130),
  text("railway", "Railway", 160),
  text("tenderNo", "Tender No.", 130),
  text("erpTenderNo", "ERP Tender No", 140),
  text("qtnNo", "QTN No", 130),
  date("dueDate", "Due Date"),
  text("erpItemSchedule", "ERP Item Schedule", 170),
  { ...text("erpCode", "ERP Code", 180), cell: (row) => <ErpCodeCell row={row} /> },
  text("item", "Item", 260),
  text("qtyInKms", "Qty (Kms)", 120),
  text("participated", "Participated", 130),
  text("reverseAuction", "Reverse Auction", 150),
  text("bidOpened", "Bid Opened", 130),
  text("reverseAuctionDone", "RA Done", 130),
  text("comparativeAvailable", "Comparative Available", 180),
  text("raAnnounced", "RA Announced", 140),
  date("raAnnouncedOnDate", "RA Announced On"),
  text("expectedContractStatus", "Expected Contract Status", 200),
];

const getRowId = (row: Row) => String(row.id);

export function RailwaysView() {
  const dispatch = useAppDispatch();
  const { rows, loading, error } = useAppSelector((s) => s.railways);
  const itemCount = useAppSelector((s) => s.items.rows.length);

  useEffect(() => {
    if (rows.length === 0) dispatch(fetchRailways());
    if (itemCount === 0) dispatch(fetchItems());
  }, [dispatch, rows.length, itemCount]);

  return (
    <ClientTablePage
      title="Railways Register"
      noun="rows"
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      loading={loading}
      error={error}
      onRetry={() => dispatch(fetchRailways())}
    />
  );
}
