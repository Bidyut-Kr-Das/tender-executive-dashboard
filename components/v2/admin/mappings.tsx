"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { MERGED_FIELDS } from "@/lib/tender-columns";
import { CellAction, Clamp } from "@/components/v2/data-table/cells";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn } from "@/components/v2/data-table/types";
import { Button, IconButton } from "@/components/v2/ui/button";
import { Field, Input } from "@/components/v2/ui/field";
import { Combobox } from "@/components/v2/ui/overlay";
import { FormDialog, RowActions, request, useRows } from "./shared";

interface Mapping {
  id: number;
  excelHeader: string;
  dbField: string;
  displayName: string | null;
}

/** A mapping plus the display name its DB field shows under. */
type Row = Mapping & { groupDisplayName: string };

interface Draft {
  excelHeader: string;
  dbField: string | null;
  displayName: string;
}

/** Which mapping the dialog edits, or the DB field a new header is added to. */
type Editing = { row?: Mapping; dbField?: string };

const ENDPOINT = "/api/column-mappings";
const DB_FIELDS = [...MERGED_FIELDS].sort().map((f) => ({ value: f, label: f }));

const load = async () => (await request<{ mappings: Mapping[] }>(ENDPOINT)).mappings;
const getRowId = (row: Row) => String(row.id);
const byDbField = (row: Row) => row.dbField;

export function ColumnMappingsView() {
  const t = useRows(load);
  const [editing, setEditing] = useState<Editing | null>(null);

  // One group per DB field, as the headers that feed it; the group's display
  // name is the first one set among them.
  const rows = useMemo<Row[]>(() => {
    const display = new Map<string, string>();
    for (const m of t.rows) {
      if (m.displayName && !display.has(m.dbField)) display.set(m.dbField, m.displayName);
    }
    return [...t.rows]
      .sort((a, b) => a.dbField.localeCompare(b.dbField))
      .map((m) => ({ ...m, groupDisplayName: display.get(m.dbField) ?? "" }));
  }, [t.rows]);

  const { remove } = t;
  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      {
        id: "dbField",
        header: "DB Field",
        width: 260,
        spanGroup: true,
        filter: selectFilter(),
        cell: (row) => (
          <CellAction
            action={
              <IconButton
                size="sm"
                label={`Add header to ${row.dbField}`}
                onClick={() => setEditing({ dbField: row.dbField })}
              >
                <Plus className="size-3.5" />
              </IconButton>
            }
          >
            <Clamp className="font-medium">{row.dbField}</Clamp>
          </CellAction>
        ),
      },
      {
        id: "groupDisplayName",
        header: "Display Name",
        width: 240,
        spanGroup: true,
        filter: selectFilter(),
      },
      { id: "excelHeader", header: "Excel Header", width: 320, filter: selectFilter() },
      {
        id: "actions",
        header: "Actions",
        width: 100,
        search: false,
        sortable: false,
        cell: (row) => (
          <RowActions
            what={`header "${row.excelHeader}"`}
            onEdit={() => setEditing({ row })}
            onDelete={() => request(`${ENDPOINT}/${row.id}`, "DELETE").then(() => remove(row.id))}
          />
        ),
      },
    ],
    [remove],
  );

  const row = editing?.row;
  const initial = useMemo<Draft>(
    () => ({
      excelHeader: row?.excelHeader ?? "",
      dbField: row?.dbField ?? editing?.dbField ?? null,
      displayName: row?.displayName ?? "",
    }),
    [row, editing?.dbField],
  );

  const save = async (draft: Draft) => {
    const excelHeader = draft.excelHeader.trim();
    const dbField = draft.dbField?.trim();
    if (!excelHeader) throw new Error("Excel Header is required");
    if (!dbField) throw new Error("DB Field is required");
    const body = { excelHeader, dbField, displayName: draft.displayName.trim() || null };
    const { mapping } = row
      ? await request<{ mapping: Mapping }>(`${ENDPOINT}/${row.id}`, "PATCH", body)
      : await request<{ mapping: Mapping }>(ENDPOINT, "POST", body);
    t.upsert(mapping);
    toast.success(row ? "Mapping updated" : "Mapping created");
  };

  return (
    <>
      <ClientTablePage
        title="Column Mappings"
        noun="headers"
        rows={rows}
        columns={columns}
        getRowId={getRowId}
        groupBy={byDbField}
        loading={t.loading}
        error={t.error}
        onRetry={t.reload}
        actions={
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEditing({})}>
            Add mapping
          </Button>
        }
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={row ? "Edit mapping" : "Add mapping"}
        initial={initial}
        onSubmit={save}
      >
        {(draft, set) => (
          <>
            <Field label="Excel header">
              <Input
                autoFocus
                value={draft.excelHeader}
                onChange={(e) => set({ excelHeader: e.target.value })}
              />
            </Field>
            <Field label="DB field">
              <Combobox
                label="DB field"
                placeholder="Select a field"
                value={draft.dbField}
                onChange={(dbField) => set({ dbField })}
                options={DB_FIELDS}
                disabled={!!row || !!editing?.dbField}
              />
            </Field>
            <Field label="Display name (optional)">
              <Input
                placeholder="UI column header override"
                value={draft.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
              />
            </Field>
          </>
        )}
      </FormDialog>
    </>
  );
}
