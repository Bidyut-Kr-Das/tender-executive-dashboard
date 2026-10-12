"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, EyeOff, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CATEGORY_OPTIONS, STATE_OPTIONS } from "@/lib/credentialsOptions";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  updateCredential,
  type CredentialRecord as Row,
} from "@/lib/slices/credentialsSlice";
import { DataTable } from "@/components/v2/data-table/data-table";
import { SelectEditCell, TextEditCell } from "@/components/v2/data-table/edit-cells";
import { exportRows } from "@/components/v2/data-table/export";
import {
  selectFilter,
  type DataTableColumn,
  type FilterChip,
  type SortState,
} from "@/components/v2/data-table/types";
import { useClientTable } from "@/components/v2/data-table/use-client-table";
import { Button, IconButton } from "@/components/v2/ui/button";
import { describeError } from "@/components/v2/ui/errors";
import { Field, Input, Textarea } from "@/components/v2/ui/field";
import { FormDialog, RowActions } from "@/components/v2/ui/form-dialog";
import { Menu, MenuItem, Select } from "@/components/v2/ui/overlay";
import { Page, PageHeader, PageSkeleton, Pill } from "@/components/v2/ui/page";

type Column = DataTableColumn<Row>;
type EditableField = Exclude<keyof Row, "id" | "createdAt" | "updatedAt" | "userId">;

const UNCATEGORIZED = "(Uncategorized)";
const categoryOf = (row: Row) => row.category?.trim() || UNCATEGORIZED;

const CATEGORIES = CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }));
const STATES = STATE_OPTIONS.map((s) => ({ value: s, label: s }));

const defaultSort: SortState = { column: "createdAt", direction: "desc" };
const getRowId = (row: Row) => row.id;

function buildColumns(canEdit: boolean, dispatch: ReturnType<typeof useAppDispatch>): Column[] {
  const save = (row: Row, field: EditableField) => (next: string) =>
    dispatch(updateCredential({ id: row.id, field, value: next === "" ? null : next })).unwrap();

  const text = (
    id: EditableField,
    header: string,
    extra: { masked?: boolean; multiline?: boolean } = {},
  ): Column => ({
    id,
    header,
    width: 200,
    // A value list would spell out every password in the filter.
    filter: extra.masked ? undefined : selectFilter(),
    text: (row) => row[id] ?? "",
    cell: (row) => (
      <TextEditCell
        label={header}
        value={row[id] ?? ""}
        onSave={save(row, id)}
        readOnly={!canEdit}
        {...extra}
      />
    ),
  });

  const choice = (id: EditableField, header: string, options: { value: string; label: string }[]): Column => ({
    id,
    header,
    width: 180,
    filter: selectFilter(),
    text: (row) => row[id] ?? "",
    cell: (row) => (
      <SelectEditCell
        label={header}
        value={row[id] ?? ""}
        options={options}
        onSave={save(row, id)}
        readOnly={!canEdit}
      />
    ),
  });

  const columns: Column[] = [
    choice("category", "Category", CATEGORIES),
    text("websites", "Websites"),
    choice("states", "States", STATES),
    { id: "userId", header: "User ID", width: 200, filter: selectFilter(), text: (row) => row.userId ?? "" },
    text("password", "Password", { masked: true }),
    text("mobileNo", "Mobile No"),
    text("profilePassword", "Profile Password", { masked: true }),
    text("dscName", "DSC Name"),
    text("dscPassword", "DSC Password", { masked: true }),
    text("otherRef", "Other Ref", { multiline: true }),
    {
      id: "createdAt",
      header: "Created",
      width: 140,
      search: false,
      filter: { type: "dateRange" },
      text: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : ""),
    },
  ];
  if (canEdit) {
    columns.push({
      id: "actions",
      header: "Actions",
      width: 90,
      search: false,
      sortable: false,
      cell: (row) => (
        <RowActions what="this credential" onDelete={() => dispatch(deleteCredential(row.id)).unwrap()} />
      ),
    });
  }
  return columns;
}

const ADD_FIELDS = [
  "category",
  "states",
  "websites",
  "password",
  "mobileNo",
  "profilePassword",
  "dscName",
  "dscPassword",
  "otherRef",
] as const;
type Draft = Record<(typeof ADD_FIELDS)[number], string>;
const BLANK = Object.fromEntries(ADD_FIELDS.map((f) => [f, ""])) as Draft;

function PasswordInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        type={shown ? "text" : "password"}
        autoComplete="off"
        className="pr-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <IconButton
        size="sm"
        label={shown ? "Hide" : "Show"}
        className="absolute right-1 top-1"
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </IconButton>
    </div>
  );
}

export function CredentialsView() {
  const dispatch = useAppDispatch();
  const { data: session } = useSession();
  const canEdit = session?.user?.role === "admin" || session?.user?.role === "developer";
  const { data, loading, refreshing, error } = useAppSelector((s) => s.credentials);
  const [category, setCategory] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    dispatch(fetchCredentials());
  }, [dispatch]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data) counts.set(categoryOf(row), (counts.get(categoryOf(row)) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [data]);

  const inCategory = useMemo(
    () => (category ? data.filter((row) => categoryOf(row) === category) : data),
    [data, category],
  );

  const columns = useMemo(() => buildColumns(canEdit, dispatch), [canEdit, dispatch]);
  const { table, filtered } = useClientTable(inCategory, columns, { defaultSort });

  const extraChips = useMemo<FilterChip[]>(
    () =>
      category
        ? [{ key: "category", label: `Category: ${category}`, onRemove: () => setCategory(null) }]
        : [],
    [category],
  );

  const exportAs = (extension: "xlsx" | "csv") => {
    const name = `Credentials_${new Date().toISOString().slice(0, 10)}.${extension}`;
    toast.promise(
      exportRows(
        filtered,
        columns.filter((c) => c.id !== "actions"),
        name,
        "Credentials",
      ),
      {
        loading: "Preparing export...",
        success: (count) => `Exported ${count.toLocaleString("en-IN")} credentials`,
        error: async (err) => `Export failed: ${await describeError(err)}`,
      },
    );
  };

  const add = async (draft: Draft) => {
    const payload: Record<string, string | null> = {};
    for (const field of ADD_FIELDS) payload[field] = draft[field].trim() || null;
    if (!Object.values(payload).some((v) => v !== null)) throw new Error("Fill at least one field");
    await dispatch(createCredential(payload)).unwrap();
    toast.success("Credential created");
  };

  if (loading && data.length === 0) return <PageSkeleton label="credentials" />;

  return (
    <Page>
      <PageHeader
        title="Links and Password"
        meta={`${table.total.toLocaleString("en-IN")} matching`}
        actions={
          <>
            <Menu
              align="end"
              trigger={<Button icon={<Download className="size-3.5" />}>Export</Button>}
            >
              <MenuItem onClick={() => exportAs("xlsx")}>Excel (.xlsx)</MenuItem>
              <MenuItem onClick={() => exportAs("csv")}>CSV (.csv)</MenuItem>
            </Menu>
            {canEdit && (
              <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
                Add credential
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="type-label text-ink-3">Category</span>
        {categories.map((c) => (
          <Pill
            key={c.name}
            count={c.count}
            selected={category === c.name}
            onClick={() => setCategory(category === c.name ? null : c.name)}
          >
            {c.name}
          </Pill>
        ))}
      </div>

      <DataTable<Row>
        noun="credentials"
        columns={columns}
        getRowId={getRowId}
        loading={loading || refreshing}
        error={data.length === 0 ? error : null}
        onRetry={() => dispatch(fetchCredentials({ force: true }))}
        extraChips={extraChips}
        {...table}
      />

      <FormDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add credential"
        width="44rem"
        initial={BLANK}
        onSubmit={add}
      >
        {(draft, set) => (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                label="Category"
                placeholder="Select category"
                value={draft.category || null}
                options={CATEGORIES}
                onChange={(v) => set({ category: v ?? "" })}
              />
            </Field>
            <Field label="States">
              <Select
                label="States"
                placeholder="Select state"
                value={draft.states || null}
                options={STATES}
                onChange={(v) => set({ states: v ?? "" })}
              />
            </Field>
            <Field label="Websites" className="col-span-2">
              <Input value={draft.websites} onChange={(e) => set({ websites: e.target.value })} />
            </Field>
            <Field label="Password">
              <PasswordInput value={draft.password} onChange={(password) => set({ password })} />
            </Field>
            <Field label="Mobile no">
              <Input value={draft.mobileNo} onChange={(e) => set({ mobileNo: e.target.value })} />
            </Field>
            <Field label="Profile password">
              <PasswordInput
                value={draft.profilePassword}
                onChange={(profilePassword) => set({ profilePassword })}
              />
            </Field>
            <Field label="DSC name">
              <Input value={draft.dscName} onChange={(e) => set({ dscName: e.target.value })} />
            </Field>
            <Field label="DSC password">
              <PasswordInput value={draft.dscPassword} onChange={(dscPassword) => set({ dscPassword })} />
            </Field>
            <Field label="Other ref" className="col-span-2">
              <Textarea rows={2} value={draft.otherRef} onChange={(e) => set({ otherRef: e.target.value })} />
            </Field>
          </div>
        )}
      </FormDialog>
    </Page>
  );
}
