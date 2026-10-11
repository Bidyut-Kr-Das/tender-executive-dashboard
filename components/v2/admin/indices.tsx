"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn, type SortState } from "@/components/v2/data-table/types";
import { Button } from "@/components/v2/ui/button";
import { Checkbox, Field, Input } from "@/components/v2/ui/field";
import { Combobox } from "@/components/v2/ui/overlay";
import { FormDialog, RowActions, request, useRows } from "./shared";

interface ColumnIndex {
  id: number;
  columnName: string;
  displayOrder: number;
  displayName: string | null;
  visible: boolean;
}

interface Draft {
  columnName: string | null;
  displayOrder: string;
  displayName: string;
  visible: boolean;
}

const BLANK: Draft = { columnName: null, displayOrder: "", displayName: "", visible: true };
const ENDPOINT = "/api/column-indices";

const load = async () => (await request<{ indices: ColumnIndex[] }>(ENDPOINT)).indices;
const defaultSort: SortState = { column: "displayOrder", direction: "asc" };
const getRowId = (row: ColumnIndex) => String(row.id);

export function ColumnIndicesView() {
  const t = useRows(load);
  const [fields, setFields] = useState<string[]>([]);
  const [editing, setEditing] = useState<ColumnIndex | "new" | null>(null);

  useEffect(() => {
    request<{ fields?: string[] }>("/api/column-fields")
      .then((data) => data.fields && setFields(data.fields))
      .catch(() => {});
  }, []);

  const { remove } = t;
  const columns = useMemo<DataTableColumn<ColumnIndex>[]>(
    () => [
      { id: "columnName", header: "Column Name", width: 280, filter: selectFilter() },
      { id: "displayName", header: "Display Name", width: 280, filter: selectFilter(), text: (r) => r.displayName ?? "" },
      { id: "displayOrder", header: "Index", width: 110 },
      {
        id: "visible",
        header: "Visible",
        width: 110,
        search: false,
        filter: { type: "boolean" },
        text: (r) => (r.visible ? "Yes" : "No"),
      },
      {
        id: "actions",
        header: "Actions",
        width: 100,
        search: false,
        sortable: false,
        cell: (row) => (
          <RowActions
            what={`index entry for "${row.columnName}"`}
            onEdit={() => setEditing(row)}
            onDelete={() => request(`${ENDPOINT}/${row.id}`, "DELETE").then(() => remove(row.id))}
          />
        ),
      },
    ],
    [remove],
  );

  const row = editing && editing !== "new" ? editing : null;
  const initial = useMemo<Draft>(
    () =>
      row
        ? {
            columnName: row.columnName,
            displayOrder: String(row.displayOrder),
            displayName: row.displayName ?? "",
            visible: row.visible,
          }
        : BLANK,
    [row],
  );

  const save = async (draft: Draft) => {
    const columnName = draft.columnName?.trim();
    const order = draft.displayOrder.trim();
    if (!columnName) throw new Error("Column Name is required");
    if (!order) throw new Error("Display Order is required");
    const displayOrder = parseInt(order, 10);
    if (Number.isNaN(displayOrder) || displayOrder < 0) {
      throw new Error("Display Order must be a valid positive number");
    }
    const body = {
      columnName,
      displayOrder,
      displayName: draft.displayName.trim() || null,
      visible: draft.visible,
    };
    const { index } = row
      ? await request<{ index: ColumnIndex }>(`${ENDPOINT}/${row.id}`, "PATCH", body)
      : await request<{ index: ColumnIndex }>(ENDPOINT, "POST", body);
    t.upsert(index);
    toast.success(row ? "Column index updated" : "Column index created");
  };

  return (
    <>
      <ClientTablePage
        title="Column Index"
        noun="columns"
        rows={t.rows}
        columns={columns}
        getRowId={getRowId}
        loading={t.loading}
        error={t.error}
        onRetry={t.reload}
        defaultSort={defaultSort}
        actions={
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEditing("new")}>
            Add column index
          </Button>
        }
      >
        <p className="text-ink-2">Columns with the same index are sorted by creation date.</p>
      </ClientTablePage>

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={row ? "Edit column index" : "Add column index"}
        initial={initial}
        onSubmit={save}
      >
        {(draft, set) => (
          <>
            <Field label="Column name">
              <Combobox
                label="Column name"
                placeholder="Select a column"
                value={draft.columnName}
                onChange={(columnName) => set({ columnName })}
                options={fields.map((f) => ({ value: f, label: f }))}
                disabled={!!row}
              />
            </Field>
            <Field label="Display order">
              <Input
                inputMode="numeric"
                placeholder="e.g. 1, 2, 3"
                value={draft.displayOrder}
                onChange={(e) => set({ displayOrder: e.target.value })}
              />
            </Field>
            <Field label="Display name (optional)">
              <Input
                placeholder="UI column header override"
                value={draft.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
              />
            </Field>
            <Checkbox checked={draft.visible} onChange={(visible) => set({ visible })}>
              Visible in the tenders table
            </Checkbox>
          </>
        )}
      </FormDialog>
    </>
  );
}
