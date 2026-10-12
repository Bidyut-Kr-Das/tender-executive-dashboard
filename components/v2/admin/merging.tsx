"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { MERGED_FIELDS } from "@/lib/tender-columns";
import { Chips } from "@/components/v2/data-table/cells";
import { ClientTablePage } from "@/components/v2/data-table/client-table-page";
import { selectFilter, type DataTableColumn } from "@/components/v2/data-table/types";
import { Button } from "@/components/v2/ui/button";
import { Checkbox, Dash, Field, Input } from "@/components/v2/ui/field";
import { FormDialog, RowActions } from "@/components/v2/ui/form-dialog";
import { request, useRows } from "./shared";

interface Group {
  id: number;
  label: string;
  separator: string;
  fields: string[];
}

/** The server keeps `fields` as a JSON string. */
type StoredGroup = Omit<Group, "fields"> & { fields: string };
type Draft = Omit<Group, "id">;

const BLANK: Draft = { label: "", separator: "", fields: [] };
const ENDPOINT = "/api/column-groups";

const parse = (g: StoredGroup): Group => ({
  id: g.id,
  label: g.label,
  separator: g.separator,
  fields: JSON.parse(g.fields),
});
const load = async () => ((await request<{ groups?: StoredGroup[] }>(ENDPOINT)).groups ?? []).map(parse);
const getRowId = (row: Group) => String(row.id);

function FieldPicker({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (fields: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((f) => f.toLowerCase().includes(q)) : options;

  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label="Search fields"
        placeholder="Search fields"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="edge flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-lg p-2">
        {shown.map((field) => (
          <li key={field}>
            <Checkbox
              checked={selected.includes(field)}
              onChange={(on) =>
                onChange(on ? [...selected, field] : selected.filter((f) => f !== field))
              }
            >
              {field}
            </Checkbox>
          </li>
        ))}
        {shown.length === 0 && <li className="text-ink-3">No matching fields</li>}
      </ul>
    </div>
  );
}

export function ColumnMergingView() {
  const t = useRows(load);
  const [allFields, setAllFields] = useState<string[]>([]);
  const [editing, setEditing] = useState<Group | "new" | null>(null);

  useEffect(() => {
    request<{ fields?: string[] }>("/api/column-fields")
      .then((data) => data.fields && setAllFields(data.fields))
      .catch(() => {});
  }, []);

  const fieldOptions = useMemo(
    () => (allFields.length ? allFields : [...MERGED_FIELDS].sort()),
    [allFields],
  );

  const { remove } = t;
  const columns = useMemo<DataTableColumn<Group>[]>(
    () => [
      { id: "label", header: "Label", width: 260, filter: selectFilter() },
      {
        id: "separator",
        header: "Separator",
        width: 130,
        search: false,
        cell: (row) =>
          row.separator ? (
            <code className="rounded-[0.3125rem] bg-sunken px-1.5 py-px text-xs whitespace-pre">
              {row.separator}
            </code>
          ) : (
            <Dash />
          ),
      },
      {
        id: "fields",
        header: "Fields",
        width: 420,
        sortable: false,
        text: (row) => row.fields.join(", "),
        cell: (row) => <Chips items={row.fields} />,
      },
      {
        id: "actions",
        header: "Actions",
        width: 100,
        search: false,
        sortable: false,
        cell: (row) => (
          <RowActions
            what={`merged column "${row.label}"`}
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
    () => (row ? { label: row.label, separator: row.separator, fields: row.fields } : BLANK),
    [row],
  );

  const save = async (draft: Draft) => {
    const label = draft.label.trim();
    if (!label) throw new Error("Label is required");
    if (draft.fields.length < 2) throw new Error("Select at least 2 fields to merge");
    const body = { label, separator: draft.separator, fields: draft.fields };
    const { group } = row
      ? await request<{ group: StoredGroup }>(`${ENDPOINT}/${row.id}`, "PATCH", body)
      : await request<{ group: StoredGroup }>(ENDPOINT, "POST", body);
    t.upsert(parse(group));
    toast.success(row ? "Merged column updated" : "Merged column created");
  };

  return (
    <>
      <ClientTablePage
        title="Column Merging"
        noun="merged columns"
        rows={t.rows}
        columns={columns}
        getRowId={getRowId}
        loading={t.loading}
        error={t.error}
        onRetry={t.reload}
        actions={
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEditing("new")}>
            Add merged column
          </Button>
        }
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={row ? "Edit merged column" : "Add merged column"}
        initial={initial}
        onSubmit={save}
      >
        {(draft, set) => (
          <>
            <Field label="Label">
              <Input value={draft.label} onChange={(e) => set({ label: e.target.value })} />
            </Field>
            <Field label="Separator">
              <Input
                placeholder="Text placed between the merged values"
                value={draft.separator}
                onChange={(e) => set({ separator: e.target.value })}
              />
            </Field>
            <div className="flex flex-col gap-1">
              <span className="type-label text-ink-3">Fields · {draft.fields.length} selected</span>
              <FieldPicker
                options={fieldOptions}
                selected={draft.fields}
                onChange={(fields) => set({ fields })}
              />
            </div>
          </>
        )}
      </FormDialog>
    </>
  );
}
