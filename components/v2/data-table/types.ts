import type { ReactNode } from "react";
import type {
  ColumnFilterState,
  ColumnFilterType,
  FilterOption,
} from "@/lib/types";

export type { ColumnFilterState, ColumnFilterType, FilterOption };

export type ColumnFilter =
  | {
      type: "select";
      /** Static options. Server-loaded ones arrive through `getFilterOptions`. */
      options?: FilterOption[];
      /**
       * The option search box also filters rows by "contains", replacing any
       * picked values. For columns with too many distinct values to pick from.
       */
      searchAsText?: boolean;
    }
  | {
      type: "dateRange";
      /** Named ranges, stored under `select`; exclusive with a typed range. */
      presets?: FilterOption[];
    }
  | { type: "boolean" }
  | {
      /** Anything else: the column definition owns the control. */
      type: "custom";
      stateKey: ColumnFilterType;
      render: (props: {
        value: unknown;
        onChange: (value: unknown | undefined) => void;
      }) => ReactNode;
      summary: (value: unknown) => string | null;
    };

export interface CellContext {
  rowIndex: number;
}

/**
 * Everything specific to a page lives here: what a cell shows, which buttons
 * and dialogs it carries, how the column filters. The table itself knows none
 * of it, so any page can reuse it with its own definitions.
 */
export interface DataTableColumn<Row> {
  /** Row key and the id the server filters and sorts by. */
  id: string;
  header: string;
  width?: number;
  /** Pinned to the left edge. */
  frozen?: boolean;
  /** Never rendered and not offered in the column picker. */
  hidden?: boolean;
  sortable?: boolean;
  /** Free-text "contains" search on this column. Defaults to true. */
  search?: boolean;
  filter?: ColumnFilter;
  /** Further select filters shown in this column's panel, keyed by their own id. */
  extraFilters?: { id: string; label: string; options?: FilterOption[] }[];
  /** Small tags under the header label. */
  badges?: string[];
  cell?: (row: Row, ctx: CellContext) => ReactNode;
  /** Plain text for the default cell; defaults to `String(row[id])`. */
  text?: (row: Row) => string;
}

export interface SortState {
  column: string;
  direction: "asc" | "desc";
}

export interface FilterChip {
  key: string;
  label: string;
  /** Omit for an informational chip that cannot be dismissed. */
  onRemove?: () => void;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;

  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  sort: SortState | null;
  onSortChange: (sort: SortState) => void;

  filters: Record<string, ColumnFilterState>;
  /** `undefined` clears that part of the column's filter. */
  onFilterChange: (
    columnId: string,
    type: ColumnFilterType,
    value: unknown | undefined,
  ) => void;
  onResetFilters: () => void;
  /** Options for a select filter beyond its static ones; null while unknown. */
  getFilterOptions?: (columnId: string) => {
    options: FilterOption[] | null;
    loading: boolean;
  };
  /** A filter panel opened: the moment to fetch its options. */
  onFilterOpen?: (columnId: string) => void;

  /** `false` hides a column; anything else shows it. */
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  /** Chips for filters that live outside the columns. */
  extraChips?: FilterChip[];
  /** Controls placed beside the column picker. */
  actions?: ReactNode;
  noun?: string;
}

export function isFilterActive(state: ColumnFilterState | undefined): boolean {
  if (!state) return false;
  if (state.text) return true;
  if (state.select?.length) return true;
  if (state.dateRange?.startDate || state.dateRange?.endDate) return true;
  if (state.boolean != null) return true;
  if (state.rawMaterials && Object.values(state.rawMaterials).some(Boolean)) {
    return true;
  }
  return false;
}
