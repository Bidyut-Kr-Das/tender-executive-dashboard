"use client";

import { useCallback, useMemo, useState } from "react";
import { BLANK } from "./types";
import type {
  ColumnFilterState,
  ColumnFilterType,
  DataTableColumn,
  FilterOption,
  SortState,
} from "./types";

type Value = string | number | boolean | Date | null | undefined;

/**
 * A column's typed value, for sorting and for date, number and yes/no filters.
 * Needed only where `row[id]` is not already that value: an amount kept as
 * "₹1,200", a date kept as "31-12-2025".
 */
export type ColumnValues<Row> = Record<string, (row: Row) => Value>;

type Filters = Record<string, ColumnFilterState>;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// ponytail: a select filter lists at most this many values; "Contains" reaches
// the rest. Virtualise the option list if a column needs more.
const MAX_OPTIONS = 500;

const raw = <Row,>(row: Row, id: string) => (row as Record<string, unknown>)[id] as Value;

const typed = <Row,>(row: Row, id: string, values?: ColumnValues<Row>) =>
  values?.[id] ? values[id](row) : raw(row, id);

export function cellText<Row>(column: DataTableColumn<Row>, row: Row): string {
  if (column.text) return column.text(row) ?? "";
  const value = raw(row, column.id);
  return value == null ? "" : String(value);
}

function toDate(value: Value): Date | null {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local calendar day, the format the date range filter stores. */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toNumber(value: Value): number | null {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value !== "string") return null;
  const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

const isYes = (value: Value) =>
  value === true || /^(y|yes|true|1)$/i.test(String(value ?? "").trim());

function matches<Row>(
  row: Row,
  column: DataTableColumn<Row>,
  state: ColumnFilterState,
  values?: ColumnValues<Row>,
): boolean {
  if (state.text || state.select?.length) {
    const text = cellText(column, row).trim();
    if (state.text && !text.toLowerCase().includes(state.text.trim().toLowerCase())) return false;
    if (
      state.select?.length &&
      !state.select.some((v) => (v === BLANK.value ? text === "" : v === text))
    ) {
      return false;
    }
  }
  const { startDate, endDate } = state.dateRange ?? {};
  if (startDate || endDate) {
    const date = toDate(typed(row, column.id, values));
    if (!date) return false;
    const day = dayKey(date);
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;
  }
  if (state.boolean != null && isYes(typed(row, column.id, values)) !== state.boolean) {
    return false;
  }
  const { min, max } = state.numberRange ?? {};
  if (min || max) {
    const n = toNumber(typed(row, column.id, values));
    if (n == null) return false;
    if (min && n < Number(min)) return false;
    if (max && n > Number(max)) return false;
  }
  return true;
}

export function filterRows<Row>(
  rows: Row[],
  columns: DataTableColumn<Row>[],
  filters: Filters,
  values?: ColumnValues<Row>,
): Row[] {
  const active = columns.filter((c) => filters[c.id]);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((c) => matches(row, c, filters[c.id], values)));
}

/** Empty values go last in both directions. */
export function sortRows<Row>(
  rows: Row[],
  sort: SortState | null,
  values?: ColumnValues<Row>,
): Row[] {
  if (!sort) return rows;
  const flip = sort.direction === "asc" ? 1 : -1;
  const keyed = rows.map((row) => {
    const value = typed(row, sort.column, values);
    return { row, value: value instanceof Date ? value.getTime() : value };
  });
  const empty = (v: unknown) => v == null || v === "";
  keyed.sort((a, b) => {
    if (empty(a.value) || empty(b.value)) return Number(empty(a.value)) - Number(empty(b.value));
    if (typeof a.value === "number" && typeof b.value === "number") {
      return (a.value - b.value) * flip;
    }
    return collator.compare(String(a.value), String(b.value)) * flip;
  });
  return keyed.map((k) => k.row);
}

/** The distinct values of a column, as select filter options. */
export function facetOptions<Row>(rows: Row[], column: DataTableColumn<Row>): FilterOption[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const text = cellText(column, row).trim();
    if (text) seen.add(text);
  }
  return [...seen]
    .sort(collator.compare)
    .slice(0, MAX_OPTIONS)
    .map((value) => ({ value, label: value }));
}

export interface ClientTableOptions<Row> {
  defaultSort?: SortState | null;
  pageSize?: number;
  /** Keep the identity stable (module constant or memo). */
  values?: ColumnValues<Row>;
}

/**
 * Drives `DataTable` for a page that holds all its rows in the browser:
 * filtering, sorting and paging happen here instead of on the server. Spread
 * `table` into `<DataTable>`; `filtered` is every matching row, for totals and
 * exports.
 */
export function useClientTable<Row>(
  allRows: Row[],
  columns: DataTableColumn<Row>[],
  { defaultSort = null, pageSize: initialPageSize = 50, values }: ClientTableOptions<Row> = {},
) {
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<SortState | null>(defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [columnVisibility, onColumnVisibilityChange] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () => sortRows(filterRows(allRows, columns, filters, values), sort, values),
    [allRows, columns, filters, sort, values],
  );

  // Rows can shrink under the current page (a filter outside the table).
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = useMemo(
    () => filtered.slice((current - 1) * pageSize, current * pageSize),
    [filtered, current, pageSize],
  );

  const onFilterChange = useCallback(
    (columnId: string, type: ColumnFilterType, value: unknown | undefined) => {
      // Functional: a filter panel can send two changes in one event.
      setFilters((prev) => {
        const state = { ...prev[columnId], [type]: value } as ColumnFilterState;
        if (value === undefined) delete state[type];
        const next = { ...prev };
        if (Object.keys(state).length > 0) next[columnId] = state;
        else delete next[columnId];
        return next;
      });
      setPage(1);
    },
    [],
  );

  const onResetFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const onSortChange = useCallback((next: SortState) => {
    setSort(next);
    setPage(1);
  }, []);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  // Worked out the first time a column's filter asks, then kept until rows change.
  const facets = useMemo(() => {
    const cache = new Map<string, { options: FilterOption[]; loading: false }>();
    const byId = new Map(columns.map((c) => [c.id, c]));
    return (columnId: string) => {
      const column = byId.get(columnId);
      if (!column || column.filter?.type !== "select") return { options: null, loading: false };
      let entry = cache.get(columnId);
      if (!entry) {
        entry = { options: facetOptions(allRows, column), loading: false };
        cache.set(columnId, entry);
      }
      return entry;
    };
  }, [allRows, columns]);

  return {
    filtered,
    table: {
      rows,
      total: filtered.length,
      page: current,
      pageSize,
      onPageChange: setPage,
      onPageSizeChange,
      sort,
      onSortChange,
      filters,
      onFilterChange,
      onResetFilters,
      getFilterOptions: facets,
      columnVisibility,
      onColumnVisibilityChange,
    },
  };
}
