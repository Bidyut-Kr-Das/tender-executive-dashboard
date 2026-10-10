"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  ListFilter,
  SearchX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/v2/ui/button";
import { Input } from "@/components/v2/ui/field";
import { Menu, MenuCheckItem, Popover, Select } from "@/components/v2/ui/overlay";
import { ColumnFilterPanel, summarizeFilter } from "./column-filter";
import {
  isFilterActive,
  type ColumnFilterType,
  type DataTableColumn,
  type DataTableProps,
  type FilterChip,
} from "./types";

const DEFAULT_WIDTH = 180;
const MIN_WIDTH = 50;
const MAX_FROZEN_SHARE = 0.5;

/* --------------------------------- Header ---------------------------------- */

function HeaderCell<Row>({
  column,
  width,
  left,
  isLastFrozen,
  sortDirection,
  onSort,
  onResize,
  active,
  panel,
}: {
  column: DataTableColumn<Row>;
  width: number;
  left: number | null;
  isLastFrozen: boolean;
  sortDirection: "asc" | "desc" | null;
  onSort: () => void;
  onResize: (width: number) => void;
  active: boolean;
  panel: ReactNode;
}) {
  const sortable = column.sortable !== false;
  const hasFilter = column.search !== false || !!column.filter;

  // Pointer capture keeps the drag alive when the cursor leaves the handle.
  const onHandleDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let frame = 0;
    const move = (ev: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        onResize(Math.max(MIN_WIDTH, width + ev.clientX - startX)),
      );
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  return (
    <th
      scope="col"
      aria-sort={
        sortDirection === "asc"
          ? "ascending"
          : sortDirection === "desc"
            ? "descending"
            : undefined
      }
      style={left != null ? { left } : undefined}
      className={cn(
        "glass sticky top-0 border-b p-0 text-left align-middle font-medium",
        left != null ? "z-30" : "z-20",
        isLastFrozen &&
          "group-data-[sx=true]/dt:shadow-[6px_0_8px_-6px_rgb(0_0_0/0.18)]",
      )}
    >
      <div className="flex h-10 items-center gap-0.5 pl-3 pr-1.5">
        <button
          type="button"
          disabled={!sortable}
          onClick={onSort}
          className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs text-ink-2 disabled:cursor-default"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate" title={column.header}>
              {column.header}
            </span>
            {column.badges && column.badges.length > 0 && (
              <span className="truncate text-[0.625rem] font-normal leading-tight text-ink-3">
                {column.badges.join(" · ")}
              </span>
            )}
          </span>
          {sortDirection === "asc" && (
            <ArrowUp className="size-3 shrink-0 text-accent" aria-hidden />
          )}
          {sortDirection === "desc" && (
            <ArrowDown className="size-3 shrink-0 text-accent" aria-hidden />
          )}
        </button>
        {hasFilter && (
          <Popover
            trigger={
              <IconButton
                size="sm"
                label={`Filter ${column.header}`}
                className={cn("relative", active && "bg-accent-soft text-accent")}
              >
                <ListFilter className="size-3.5" />
              </IconButton>
            }
          >
            {panel}
          </Popover>
        )}
      </div>
      <span
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onHandleDown}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none after:absolute after:inset-y-2.5 after:left-1/2 after:w-px after:bg-line hover:after:inset-y-1 hover:after:w-0.5 hover:after:bg-accent"
      />
    </th>
  );
}

/* ---------------------------------- Rows ----------------------------------- */

interface Placed<Row> {
  column: DataTableColumn<Row>;
  left: number | null;
  isLastFrozen: boolean;
}

function RowInner<Row>({
  row,
  rowIndex,
  placed,
  measure,
}: {
  row: Row;
  rowIndex: number;
  placed: Placed<Row>[];
  measure: (el: HTMLTableRowElement | null) => void;
}) {
  return (
    <tr ref={measure} data-index={rowIndex} className="group/row">
      {placed.map(({ column, left, isLastFrozen }) => (
        <td
          key={column.id}
          style={left != null ? { left } : undefined}
          className={cn(
            "border-b bg-surface px-3 py-2 align-top group-hover/row:bg-(--row-hover-bg)",
            left != null && "sticky z-10",
            isLastFrozen &&
              "group-data-[sx=true]/dt:shadow-[6px_0_8px_-6px_rgb(0_0_0/0.18)]",
          )}
        >
          {column.cell ? (
            column.cell(row, { rowIndex })
          ) : (
            <DefaultCell
              text={
                column.text
                  ? column.text(row)
                  : String((row as Record<string, unknown>)[column.id] ?? "")
              }
            />
          )}
        </td>
      ))}
    </tr>
  );
}

const RowView = memo(RowInner) as typeof RowInner;

/** Long text is capped at three lines and scrolls inside the cell, scrollbar hidden. */
function DefaultCell({ text }: { text: string }) {
  if (!text) return <span className="text-ink-3">–</span>;
  return (
    <div className="no-scrollbar max-h-[3lh] overflow-y-auto whitespace-pre-line wrap-break-word">
      {text}
    </div>
  );
}

/* ------------------------------- Pagination -------------------------------- */

function pageWindow(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function Pagination({
  total,
  page,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  noun,
}: Pick<
  DataTableProps<unknown>,
  "total" | "page" | "pageSize" | "onPageChange" | "onPageSizeChange"
> & { pageSizeOptions: number[]; noun: string }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2 text-xs text-ink-2">
      <span className="tabular-nums">
        {fmt(from)}–{fmt(to)} of {fmt(total)} {noun}
      </span>
      <div className="flex items-center gap-1.5">
        <span>Rows per page</span>
        <div className="w-18">
          <Select
            size="sm"
            label="Rows per page"
            value={String(pageSize)}
            onChange={(v) => v && onPageSizeChange(Number(v))}
            options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
          />
        </div>
      </div>
      <nav aria-label="Pagination" className="ml-auto flex items-center gap-0.5">
        <IconButton size="sm" label="First page" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-3.5" />
        </IconButton>
        {pageWindow(page, pageCount).map((p) => (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={cn(
              "transition-transform duration-(--dur-press) ease-out motion-safe:not-disabled:active:scale-97 h-6 min-w-6 rounded-md px-1.5 tabular-nums",
              p === page ? "bg-accent-soft font-medium text-accent-ink" : "not-disabled:hover:bg-hover",
            )}
          >
            {p}
          </button>
        ))}
        <IconButton size="sm" label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Last page" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)}>
          <ChevronsRight className="size-3.5" />
        </IconButton>
      </nav>
    </footer>
  );
}

/* ---------------------------------- Chips ---------------------------------- */

function Chip({ chip }: { chip: FilterChip }) {
  return (
    <span className="transition-[scale,opacity] duration-(--dur-pop) ease-out starting:scale-95 starting:opacity-0 inline-flex h-6 max-w-80 items-center gap-1 rounded-md bg-accent-soft pl-2 pr-1 text-xs text-accent-ink">
      <span className="truncate" title={chip.label}>
        {chip.label}
      </span>
      {chip.onRemove ? (
        <button
          type="button"
          aria-label={`Remove filter: ${chip.label}`}
          onClick={chip.onRemove}
          className="transition-transform duration-(--dur-press) ease-out motion-safe:not-disabled:active:scale-97 not-disabled:hover:bg-hover flex size-4 shrink-0 items-center justify-center rounded"
        >
          <X className="size-3" />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  );
}

function ColumnPicker<Row>({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
}: Pick<DataTableProps<Row>, "columns" | "columnVisibility" | "onColumnVisibilityChange">) {
  const [query, setQuery] = useState("");
  const togglable = columns.filter((c) => !c.hidden);
  const shownCount = togglable.filter((c) => columnVisibility[c.id] !== false).length;
  const q = query.trim().toLowerCase();

  return (
    <Menu
      align="end"
      className="w-64"
      trigger={
        <Button icon={<Columns3 className="size-3.5" />}>
          Columns
          <span className="tabular-nums text-ink-3">
            {shownCount}/{togglable.length}
          </span>
        </Button>
      }
    >
      <div className="p-1 pb-1.5">
        <Input
          aria-label="Search columns"
          placeholder="Search columns"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Typing must reach the input, not the menu's typeahead.
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      {togglable
        .filter((c) => !q || c.header.toLowerCase().includes(q))
        .map((c) => {
          const shown = columnVisibility[c.id] !== false;
          return (
            <MenuCheckItem
              key={c.id}
              checked={shown}
              onCheckedChange={(next) => {
                // At least one column stays.
                if (!next && shownCount <= 1) return;
                const vis = { ...columnVisibility };
                if (next) delete vis[c.id];
                else vis[c.id] = false;
                onColumnVisibilityChange(vis);
              }}
            >
              <span className="min-w-0 flex-1 truncate">{c.header}</span>
            </MenuCheckItem>
          );
        })}
    </Menu>
  );
}

/* ---------------------------------- Table ---------------------------------- */

export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  total,
  page,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100, 500],
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  filters,
  onFilterChange,
  onResetFilters,
  getFilterOptions,
  onFilterOpen,
  columnVisibility,
  onColumnVisibilityChange,
  loading = false,
  error = null,
  onRetry,
  extraChips = [],
  actions,
  noun = "rows",
}: DataTableProps<Row>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [scrolledX, setScrolledX] = useState(false);

  const visible = useMemo(() => {
    const shown = columns.filter((c) => !c.hidden && columnVisibility[c.id] !== false);
    return [...shown.filter((c) => c.frozen), ...shown.filter((c) => !c.frozen)];
  }, [columns, columnVisibility]);

  const widthOf = useCallback(
    (c: DataTableColumn<Row>) => widths[c.id] ?? c.width ?? DEFAULT_WIDTH,
    [widths],
  );

  // Pinned columns may take at most this share of the viewport; past it the
  // rightmost ones scroll with the rest, so there is always room to scroll.
  const [viewportWidth, setViewportWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewportWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const placed = useMemo(() => {
    const budget = viewportWidth ? viewportWidth * MAX_FROZEN_SHARE : Infinity;
    let left = 0;
    let full = false;
    const out = visible.map((column): Placed<Row> => {
      const pinned =
        !!column.frozen && !full && (left === 0 || left + widthOf(column) <= budget);
      if (column.frozen && !pinned) full = true;
      const at = pinned ? left : null;
      if (pinned) left += widthOf(column);
      return { column, left: at, isLastFrozen: false };
    });
    const lastFrozen = out.findLastIndex((p) => p.left != null);
    if (lastFrozen >= 0) out[lastFrozen].isLastFrozen = true;
    return out;
  }, [visible, widthOf, viewportWidth]);

  const tableWidth = visible.reduce((sum, c) => sum + widthOf(c), 0);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
    getItemKey: (i) => getRowId(rows[i]),
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start : 0;
  const padBottom = items.length
    ? virtualizer.getTotalSize() - items[items.length - 1].end
    : 0;

  // A new page starts at its top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize]);

  const handleSort = (id: string) =>
    onSortChange({
      column: id,
      direction: sort?.column === id && sort.direction === "desc" ? "asc" : "desc",
    });

  const clearColumn = useCallback(
    (id: string) => {
      const s = filters[id];
      if (!s) return;
      for (const key of Object.keys(s) as ColumnFilterType[]) {
        if (s[key] !== undefined) onFilterChange(id, key, undefined);
      }
    },
    [filters, onFilterChange],
  );

  const chips = useMemo(() => {
    const out: FilterChip[] = [...extraChips];
    for (const c of columns) {
      if (isFilterActive(filters[c.id])) {
        out.push({
          key: c.id,
          label: `${c.header}: ${summarizeFilter(c, filters[c.id], getFilterOptions?.(c.id).options)}`,
          onRemove: () => clearColumn(c.id),
        });
      }
      for (const e of c.extraFilters ?? []) {
        if (!isFilterActive(filters[e.id])) continue;
        out.push({
          key: e.id,
          label: `${e.label}: ${summarizeFilter({ filter: { type: "select", options: e.options } }, filters[e.id], getFilterOptions?.(e.id).options)}`,
          onRemove: () => clearColumn(e.id),
        });
      }
    }
    return out;
  }, [extraChips, columns, filters, getFilterOptions, clearColumn]);

  const hasColumnFilters = Object.values(filters).some(isFilterActive);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line),0_1px_3px_rgb(0_0_0/0.05)]">
      <div className="flex shrink-0 items-start gap-3 border-b px-3 py-2">
        <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {chips.length === 0 && (
            <span className="text-xs text-ink-3">
              No filters. Use the filter control in any column header.
            </span>
          )}
          {chips.map((chip) => (
            <Chip key={chip.key} chip={chip} />
          ))}
          {hasColumnFilters && (
            <Button size="sm" variant="ghost" onClick={onResetFilters}>
              Reset column filters
            </Button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <ColumnPicker
            columns={columns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={onColumnVisibilityChange}
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {loading && (
          <div
            role="progressbar"
            aria-label={`Loading ${noun}`}
            className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden"
          >
            <div className="h-full w-2/5 animate-progress bg-accent motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-50" />
          </div>
        )}

        <div
          ref={scrollRef}
          data-sx={scrolledX}
          onScroll={(e) => {
            const next = e.currentTarget.scrollLeft > 0;
            if (next !== scrolledX) setScrolledX(next);
          }}
          className="group/dt h-full overflow-auto overscroll-contain"
        >
          <table
            aria-busy={loading}
            style={{ width: tableWidth, ["--row-hover-bg" as string]: "color-mix(in srgb, var(--surface), var(--ink) 4%)" }}
            className="table-fixed border-separate border-spacing-0"
          >
            <colgroup>
              {visible.map((c) => (
                <col key={c.id} style={{ width: widthOf(c) }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {placed.map(({ column, left, isLastFrozen }) => (
                  <HeaderCell
                    key={column.id}
                    column={column}
                    width={widthOf(column)}
                    left={left}
                    isLastFrozen={isLastFrozen}
                    sortDirection={sort?.column === column.id ? sort.direction : null}
                    onSort={() => handleSort(column.id)}
                    onResize={(w) => setWidths((prev) => ({ ...prev, [column.id]: w }))}
                    active={
                      isFilterActive(filters[column.id]) ||
                      (column.extraFilters ?? []).some((e) => isFilterActive(filters[e.id]))
                    }
                    panel={
                      <ColumnFilterPanel
                        column={column}
                        filters={filters}
                        onFilterChange={onFilterChange}
                        getFilterOptions={getFilterOptions}
                        onFilterOpen={onFilterOpen}
                      />
                    }
                  />
                ))}
              </tr>
            </thead>
            <tbody
              className={cn("transition-opacity duration-150", loading && "opacity-55")}
            >
              {padTop > 0 && (
                <tr aria-hidden>
                  <td colSpan={visible.length} style={{ height: padTop }} />
                </tr>
              )}
              {items.map((item) => (
                <RowView
                  key={item.key}
                  row={rows[item.index]}
                  rowIndex={item.index}
                  placed={placed}
                  measure={virtualizer.measureElement}
                />
              ))}
              {padBottom > 0 && (
                <tr aria-hidden>
                  <td colSpan={visible.length} style={{ height: padBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {error ? (
          <div className="absolute inset-x-0 bottom-0 top-10 grid place-items-center bg-surface p-6">
            <div className="flex max-w-sm flex-col items-center gap-2 text-center">
              <AlertTriangle className="size-5 text-bad" aria-hidden />
              <p className="font-medium">Could not load {noun}</p>
              <p className="text-ink-2">{error}</p>
              {onRetry && (
                <Button className="mt-1" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          </div>
        ) : (
          rows.length === 0 &&
          !loading && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-10 grid place-items-center p-6">
              <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-2 text-center">
                <SearchX className="size-5 text-ink-3" aria-hidden />
                <p className="font-medium">No {noun} match these filters</p>
                {hasColumnFilters && (
                  <Button className="mt-1" onClick={onResetFilters}>
                    Reset column filters
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        noun={noun}
      />
    </section>
  );
}
