"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/v2/ui/button";
import { Field, Input } from "@/components/v2/ui/field";
import type {
  ColumnFilterState,
  ColumnFilterType,
  DataTableColumn,
  DataTableProps,
  FilterOption,
} from "./types";
import { isFilterActive } from "./types";

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
              className="hover-bg flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
            >
              <span
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-[0.25rem]",
                  isOn
                    ? "bg-accent text-on-accent"
                    : "shadow-[inset_0_0_0_1px_var(--line-strong)]",
                )}
              >
                {isOn && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 wrap-break-word">{o.label}</span>
            </button>
          </li>
        );
      })}
      {loading && (
        <li className="flex items-center gap-2 px-2 py-1.5 text-ink-3">
          <Loader2 className="spin size-3.5" aria-hidden /> Loading values
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
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={preset === p.value ? "primary" : "secondary"}
              aria-pressed={preset === p.value}
              onClick={() => {
                onChange("dateRange", undefined);
                onChange("select", preset === p.value ? undefined : [p.value]);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="From">
          <Input
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => setRange(e.target.value, end)}
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setRange(start, e.target.value)}
          />
        </Field>
      </div>
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
  const choices: { label: string; value: boolean | null }[] = [
    { label: "Any", value: null },
    { label: "Yes", value: true },
    { label: "No", value: false },
  ];
  return (
    <div className="flex gap-1.5">
      {choices.map((c) => (
        <Button
          key={c.label}
          size="sm"
          variant={value === c.value ? "primary" : "secondary"}
          aria-pressed={value === c.value}
          onClick={() => onChange("boolean", c.value ?? undefined)}
        >
          {c.label}
        </Button>
      ))}
    </div>
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
      <h4 className="text-[0.6875rem] font-medium tracking-[0.02em] text-ink-3">
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

/** Body of a column's filter popover. */
export function ColumnFilterPanel<Row>({
  column,
  filters,
  onFilterChange,
  getFilterOptions,
  onFilterOpen,
}: {
  column: DataTableColumn<Row>;
} & Pick<
  DataTableProps<Row>,
  "filters" | "onFilterChange" | "getFilterOptions" | "onFilterOpen"
>) {
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
  const anyActive =
    isFilterActive(state) || (column.extraFilters ?? []).some((e) => isFilterActive(filters[e.id]));

  const clearAll = () => {
    for (const id of [column.id, ...(column.extraFilters ?? []).map((e) => e.id)]) {
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

      {searchBox && (
        <DebouncedInput
          autoFocus
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
