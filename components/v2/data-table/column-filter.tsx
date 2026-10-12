"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/v2/ui/button";
import { DateRange } from "@/components/v2/ui/calendar";
import { CheckMark, Choice, Input } from "@/components/v2/ui/field";
import type {
  ColumnFilterState,
  ColumnFilterType,
  DataTableColumn,
  DataTableProps,
  FilterOption,
} from "./types";
import { filterIds, isFilterActive } from "./types";

type OnChange = (type: ColumnFilterType, value: unknown | undefined) => void;

/** Text box that reports 300ms after the last keystroke. */
function DebouncedInput({
  value,
  onCommit,
  placeholder,
  autoFocus,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  label: string;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLocal(value), [value]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <Input
        aria-label={label}
        autoFocus={autoFocus}
        value={local}
        placeholder={placeholder}
        className="pl-8"
        onChange={(e) => {
          const next = e.target.value;
          setLocal(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onCommit(next), 300);
        }}
      />
    </div>
  );
}

function OptionList({
  options,
  loading,
  selected,
  onToggle,
  query,
}: {
  options: FilterOption[];
  loading: boolean;
  selected: string[];
  onToggle: (value: string) => void;
  query: string;
}) {
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <ul className="-mx-1 flex max-h-64 flex-col overflow-y-auto">
      {shown.map((o) => {
        const isOn = selected.includes(o.value);
        return (
          <li key={o.value}>
            <button
              type="button"
              role="checkbox"
              aria-checked={isOn}
              onClick={() => onToggle(o.value)}
              className="not-disabled:hover:bg-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
            >
              <CheckMark checked={isOn} />
              <span className="min-w-0 flex-1 wrap-break-word">{o.label}</span>
            </button>
          </li>
        );
      })}
      {loading && (
        <li className="flex items-center gap-2 px-2 py-1.5 text-ink-3">
          <Loader2 className="animate-spin size-3.5" aria-hidden /> Loading values
        </li>
      )}
      {!loading && shown.length === 0 && (
        <li className="px-2 py-1.5 text-ink-3">No matching values</li>
      )}
    </ul>
  );
}

function SelectFilter({
  state,
  onChange,
  options,
  loading,
  searchAsText,
}: {
  state: ColumnFilterState | undefined;
  onChange: OnChange;
  options: FilterOption[];
  loading: boolean;
  searchAsText?: boolean;
}) {
  const [query, setQuery] = useState(searchAsText ? (state?.text ?? "") : "");
  const selected = state?.select ?? [];

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    if (searchAsText) onChange("text", undefined);
    onChange("select", next.length ? next : undefined);
  };

  return (
    <div className="flex flex-col gap-2">
      {(searchAsText || options.length > 8) && (
        <DebouncedInput
          label={searchAsText ? "Search values or filter by text" : "Search values"}
          value={query}
          placeholder={searchAsText ? "Search or filter by text" : "Search values"}
          onCommit={(text) => {
            setQuery(text);
            if (!searchAsText) return;
            onChange("select", undefined);
            onChange("text", text || undefined);
          }}
        />
      )}
      <OptionList
        options={options}
        loading={loading}
        selected={selected}
        onToggle={toggle}
        query={query}
      />
    </div>
  );
}

function DateRangeFilter({
  state,
  onChange,
  presets,
}: {
  state: ColumnFilterState | undefined;
  onChange: OnChange;
  presets?: FilterOption[];
}) {
  const start = state?.dateRange?.startDate ?? "";
  const end = state?.dateRange?.endDate ?? "";
  const preset = state?.select?.[0] ?? "";

  const setRange = (startDate: string, endDate: string) => {
    if (presets) onChange("select", undefined);
    onChange("dateRange", startDate || endDate ? { startDate, endDate } : undefined);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {presets && (
        <Choice
          label="Presets"
          allowClear
          options={presets}
          value={preset || null}
          onChange={(next) => {
            onChange("dateRange", undefined);
            onChange("select", next ? [next] : undefined);
          }}
        />
      )}
      <DateRange from={start} to={end} onChange={setRange} />
    </div>
  );
}

function BooleanFilter({
  state,
  onChange,
}: {
  state: ColumnFilterState | undefined;
  onChange: OnChange;
}) {
  const value = state?.boolean ?? null;
  return (
    <Choice<boolean | null>
      label="Value"
      options={[
        { label: "Any", value: null },
        { label: "Yes", value: true },
        { label: "No", value: false },
      ]}
      value={value}
      onChange={(next) => onChange("boolean", next ?? undefined)}
    />
  );
}

function useResolvedOptions<Row>(
  id: string,
  staticOptions: FilterOption[] | undefined,
  getFilterOptions: DataTableProps<Row>["getFilterOptions"],
) {
  const loaded = getFilterOptions?.(id);
  // The column's own list comes first; loaded values fill in behind it.
  return useMemo(() => {
    const seen = new Set<string>();
    const merged: FilterOption[] = [];
    for (const o of [...(staticOptions ?? []), ...(loaded?.options ?? [])]) {
      if (seen.has(o.value)) continue;
      seen.add(o.value);
      merged.push(o);
    }
    return { options: merged, loading: loaded?.loading ?? false };
  }, [staticOptions, loaded?.options, loaded?.loading]);
}

function ExtraFilter<Row>({
  extra,
  filters,
  onFilterChange,
  getFilterOptions,
}: {
  extra: NonNullable<DataTableColumn<Row>["extraFilters"]>[number];
  filters: DataTableProps<Row>["filters"];
  onFilterChange: DataTableProps<Row>["onFilterChange"];
  getFilterOptions: DataTableProps<Row>["getFilterOptions"];
}) {
  const { options, loading } = useResolvedOptions(extra.id, extra.options, getFilterOptions);
  return (
    <section className="flex flex-col gap-2 border-t pt-3">
      <h4 className="type-label text-ink-3">
        {extra.label}
      </h4>
      <SelectFilter
        state={filters[extra.id]}
        onChange={(type, value) => onFilterChange(extra.id, type, value)}
        options={options}
        loading={loading}
      />
    </section>
  );
}

type FilterProps<Row> = Pick<
  DataTableProps<Row>,
  "filters" | "onFilterChange" | "getFilterOptions" | "onFilterOpen"
>;

/** One column's controls: its search box, its filter and any extra filters. */
function FilterBody<Row>({
  column,
  autoFocus,
  filters,
  onFilterChange,
  getFilterOptions,
  onFilterOpen,
}: { column: DataTableColumn<Row>; autoFocus?: boolean } & FilterProps<Row>) {
  const state = filters[column.id];
  const onChange: OnChange = (type, value) => onFilterChange(column.id, type, value);
  const filter = column.filter;
  const { options, loading } = useResolvedOptions(
    column.id,
    filter?.type === "select" ? filter.options : undefined,
    getFilterOptions,
  );

  // Mounted means the panel just opened.
  useEffect(() => {
    onFilterOpen?.(column.id);
    column.extraFilters?.forEach((e) => onFilterOpen?.(e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column.id]);

  const searchBox = column.search !== false && !(filter?.type === "select" && filter.searchAsText);

  return (
    <>
      {searchBox && (
        <DebouncedInput
          autoFocus={autoFocus}
          label={`Search ${column.header}`}
          value={state?.text ?? ""}
          placeholder="Contains"
          onCommit={(text) => onChange("text", text || undefined)}
        />
      )}

      {filter?.type === "select" && (
        <SelectFilter
          state={state}
          onChange={onChange}
          options={options}
          loading={loading}
          searchAsText={filter.searchAsText}
        />
      )}
      {filter?.type === "dateRange" && (
        <DateRangeFilter state={state} onChange={onChange} presets={filter.presets} />
      )}
      {filter?.type === "boolean" && <BooleanFilter state={state} onChange={onChange} />}
      {filter?.type === "custom" &&
        filter.render({
          value: state?.[filter.stateKey],
          onChange: (value) => onChange(filter.stateKey, value),
        })}

      {column.extraFilters?.map((extra) => (
        <ExtraFilter
          key={extra.id}
          extra={extra}
          filters={filters}
          onFilterChange={onFilterChange}
          getFilterOptions={getFilterOptions}
        />
      ))}
    </>
  );
}

/** One field of a stacked column: its sort, and its filter once opened. */
function MemberSection<Row>({
  member,
  sortDirection,
  onSort,
  ...shared
}: {
  member: DataTableColumn<Row>;
  sortDirection: "asc" | "desc" | null;
  onSort: (columnId: string) => void;
} & FilterProps<Row>) {
  const active = filterIds(member).some((id) => isFilterActive(shared.filters[id]));
  const hasFilter = member.search !== false || !!member.filter;
  // Closed until asked for, so a panel of four fields stays short and only the
  // opened field's values are fetched.
  const [open, setOpen] = useState(active);

  return (
    <section className="flex flex-col gap-2 border-t pt-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          disabled={!hasFilter}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-ink-3 transition-transform",
              open && "rotate-90",
              !hasFilter && "invisible",
            )}
            aria-hidden
          />
          <span className="type-label min-w-0 truncate text-ink-3">{member.header}</span>
          {active && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />}
        </button>
        {member.sortable !== false && (
          <IconButton
            size="sm"
            label={`Sort by ${member.header}`}
            className={cn(sortDirection && "bg-accent-soft text-accent")}
            onClick={() => onSort(member.id)}
          >
            {sortDirection === "asc" ? (
              <ArrowUp className="size-3.5" />
            ) : sortDirection === "desc" ? (
              <ArrowDown className="size-3.5" />
            ) : (
              <ArrowUpDown className="size-3.5" />
            )}
          </IconButton>
        )}
      </div>
      {open && hasFilter && <FilterBody column={member} {...shared} />}
    </section>
  );
}

/** Body of a column's filter popover. */
export function ColumnFilterPanel<Row>({
  column,
  sortedId,
  sortDirection,
  onSort,
  ...shared
}: {
  column: DataTableColumn<Row>;
  /** The member the table is sorted by, when it is one of this column's. */
  sortedId: string | null;
  sortDirection: "asc" | "desc" | null;
  onSort: (columnId: string) => void;
} & FilterProps<Row>) {
  const { filters, onFilterChange } = shared;
  const ids = filterIds(column);
  const anyActive = ids.some((id) => isFilterActive(filters[id]));

  const clearAll = () => {
    for (const id of ids) {
      const s = filters[id];
      if (!s) continue;
      for (const key of Object.keys(s) as ColumnFilterType[]) {
        if (s[key] !== undefined) onFilterChange(id, key, undefined);
      }
    }
  };

  return (
    <div className="flex w-72 flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-semibold">{column.header}</h3>
        {anyActive && (
          <Button size="sm" variant="ghost" onClick={clearAll}>
            Clear
          </Button>
        )}
      </div>

      {column.members ? (
        column.members.map((member) => (
          <MemberSection
            key={member.id}
            member={member}
            sortDirection={sortedId === member.id ? sortDirection : null}
            onSort={onSort}
            {...shared}
          />
        ))
      ) : (
        <FilterBody column={column} autoFocus {...shared} />
      )}
    </div>
  );
}

function labelFor(value: string, options: FilterOption[] | undefined | null) {
  return options?.find((o) => o.value === value)?.label ?? value;
}

/** One-line description of a column's active filter, for its chip. */
export function summarizeFilter<Row>(
  column: Pick<DataTableColumn<Row>, "filter">,
  state: ColumnFilterState,
  loadedOptions?: FilterOption[] | null,
): string {
  const parts: string[] = [];
  const filter = column.filter;
  if (state.text) parts.push(`contains "${state.text}"`);
  if (state.select?.length) {
    const known =
      filter?.type === "select"
        ? [...(filter.options ?? []), ...(loadedOptions ?? [])]
        : filter?.type === "dateRange"
          ? filter.presets
          : loadedOptions;
    const labels = state.select.map((v) => labelFor(v, known));
    parts.push(
      labels.length > 2
        ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`
        : labels.join(", "),
    );
  }
  if (state.dateRange?.startDate || state.dateRange?.endDate) {
    const { startDate, endDate } = state.dateRange;
    parts.push(
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
          ? `from ${startDate}`
          : `until ${endDate}`,
    );
  }
  if (state.boolean != null) parts.push(state.boolean ? "Yes" : "No");
  if (filter?.type === "custom") {
    const s = filter.summary(state[filter.stateKey]);
    if (s) parts.push(s);
  }
  return parts.join(" · ");
}
