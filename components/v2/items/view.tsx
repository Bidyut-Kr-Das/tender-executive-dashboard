"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { fetchItems, type ItemRow } from "@/lib/slices/itemsSlice";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn } from "@/components/v2/data-table/types";

const columns: DataTableColumn<ItemRow>[] = [
  { id: "itemcode", header: "Item Code", width: 160, filter: selectFilter() },
  { id: "itemName", header: "Item Name", width: 420, filter: selectFilter() },
  { id: "itemSchedule", header: "Item Schedule", width: 240, filter: selectFilter() },
];

const getRowId = (row: ItemRow) => String(row.id);

export function ItemsView() {
  const dispatch = useAppDispatch();
  const { rows, loading, error } = useAppSelector((s) => s.items);

  useEffect(() => {
    if (rows.length === 0) dispatch(fetchItems());
  }, [dispatch, rows.length]);

  return (
    <ClientTablePage
      title="Master Item List"
      noun="items"
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      loading={loading}
      error={error}
      onRetry={() => dispatch(fetchItems())}
    />
  );
}
