import { useEffect, useState, type ReactNode } from "react";
import { Slider } from "@base-ui/react/slider";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dash, Field, Input } from "@/components/v2/ui/field";
import type { ColumnFilter } from "./types";

/**
 * Cell building blocks for any page's column definitions. Nothing here knows
 * what a row is.
 */

const LINES = { 2: "max-h-[2lh]", 3: "max-h-[3lh]", 4: "max-h-[4lh]" } as const;

/**
 * Content capped at a few lines; the rest scrolls inside the cell. A bare
 * scroll thumb shows only while hovered; its gutter is always reserved so the
 * text does not rewrap when it appears.
 */
export function Clamp({
  children,
  lines = 3,
  className,
  title,
}: {
  children: ReactNode;
  /** `fill`: as tall as the row the other cells make, at least three lines. Needs a flex column parent. */
  lines?: keyof typeof LINES | "fill";
  className?: string;
  title?: string;
}) {
  const scroller =
    "thumb-scrollbar overflow-hidden hover:overflow-y-auto pointer-coarse:overflow-y-auto whitespace-pre-line wrap-break-word";
  if (lines === "fill") {
    // Out of flow, so the content never makes the row taller than three lines.
    return (
      <div title={title} className="relative min-h-[3lh] flex-1">
        <div className={cn("absolute inset-0", scroller, className)}>{children}</div>
      </div>
    );
  }
  return (
    <div title={title} className={cn(scroller, LINES[lines], className)}>
      {children}
    </div>
  );
}

/** A list of short values, one tag per line. */
export function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <Dash />;
  return (
    <Clamp className="flex flex-col items-start gap-1" title={items.join("\n")}>
      {items.map((item, i) => (
        <span
          key={i}
          className="max-w-full shrink-0 truncate rounded-[0.3125rem] bg-sunken px-1.5 py-px text-xs"
        >
          {item}
        </span>
      ))}
    </Clamp>
  );
}

/** Two related values in one cell: the main one, and a quieter one under it. */
export function StackedCell({ primary, secondary }: { primary: string; secondary?: string }) {
  if (!primary && !secondary) return <Dash />;
  return (
    <div className="flex flex-col">
      <Clamp lines={2} className="shrink-0 font-medium">
        {primary || "–"}
      </Clamp>
      {secondary && (
        <Clamp lines={2} className="shrink-0 text-xs text-ink-2">
          {secondary}
        </Clamp>
      )}
    </div>
  );
}

/** Cell content with an always-visible control at its trailing edge. */
export function CellAction({
  children,
  action,
  pending = false,
}: {
  children: ReactNode;
  /** Usually a small `IconButton`. */
  action?: ReactNode;
  /** Dims the cell while its change is being saved. */
  pending?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-1.5", pending && "opacity-60")}>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

type NumberRange = { min: string; max: string };

/** Minimum and maximum for a column of amounts or quantities. */
export const numberRangeFilter: ColumnFilter = {
  type: "custom",
  stateKey: "numberRange",
  render: ({ value, onChange }) => {
    const range: NumberRange = { min: "", max: "", ...(value as NumberRange | undefined) };
    const input = (key: keyof NumberRange, label: string) => (
      <Field label={label}>
        <Input
          type="number"
          inputMode="decimal"
          value={range[key]}
          onChange={(e) => {
            const next = { ...range, [key]: e.target.value };
            onChange(next.min || next.max ? next : undefined);
          }}
        />
      </Field>
    );
    return (
      <div className="grid grid-cols-2 gap-2">
        {input("min", "Min")}
        {input("max", "Max")}
      </div>
    );
  },
  summary: (value) => {
    const r = value as NumberRange | undefined;
    return r && (r.min || r.max) ? `${r.min || "0"}–${r.max || "any"}` : null;
  },
};

// ponytail: fixed rupee stops sized to the data (tender value median about
// 5 L, top about 1,600 Cr; EMD median about 7k, 99th percentile about 1.3 Cr).
// Derive them from the data if more columns need a slider.
const VALUE_STOPS = [0, 1e5, 2e5, 5e5, 1e6, 2.5e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2.5e8, 5e8, 1e9, Infinity];
const EMD_STOPS = [0, 1e3, 5e3, 1e4, 2.5e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2.5e6, 5e6, 1e7, Infinity];

function rupees(n: number): string {
  if (n === Infinity) return "No limit";
  if (n >= 1e7) return `₹${n / 1e7} Cr`;
  if (n >= 1e5) return `₹${n / 1e5} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function RupeeRange({
  stops,
  value,
  onChange,
}: {
  stops: number[];
  value: NumberRange | undefined;
  onChange: (value: unknown | undefined) => void;
}) {
  const last = stops.length - 1;
  // Nearest stop at or above a stored bound; typed formulas may fall between stops.
  const stopIndex = (bound: string, fallback: number) => {
    if (!bound) return fallback;
    const i = stops.findIndex((s) => s >= Number(bound));
    return i < 0 ? last : i;
  };
  const committed: [number, number] = [stopIndex(value?.min ?? "", 0), stopIndex(value?.max ?? "", last)];
  // Moves with the thumbs; the filter (and the query) changes on release only.
  const [range, setRange] = useState(committed);
  const key = committed.join();
  useEffect(() => setRange(committed), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slider.Root
      value={range}
      min={0}
      max={last}
      step={1}
      minStepsBetweenValues={1}
      onValueChange={(v) => setRange(v as [number, number])}
      onValueCommitted={(v) => {
        const [lo, hi] = v as [number, number];
        onChange(
          lo === 0 && hi === last
            ? undefined
            : { min: lo === 0 ? "" : String(stops[lo]), max: hi === last ? "" : String(stops[hi]) },
        );
      }}
      className="flex flex-col gap-2 px-1.5"
    >
      <div className="flex justify-between text-xs tabular-nums">
        <span>{rupees(stops[range[0]])}</span>
        <span>{rupees(stops[range[1]])}</span>
      </div>
      <Slider.Control className="flex h-5 items-center">
        <Slider.Track className="relative h-1 w-full rounded-full bg-line">
          <Slider.Indicator className="h-full rounded-full bg-accent" />
          {[0, 1].map((i) => (
            <Slider.Thumb
              key={i}
              index={i}
              aria-label={i === 0 ? "Minimum value" : "Maximum value"}
              className="size-4 rounded-full border-2 border-accent bg-surface focus-visible:outline-2 focus-visible:outline-accent"
            />
          ))}
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

/** Rupee amount between two stops, picked with a two-thumb slider. */
const rupeeRangeFilter = (stops: number[]): ColumnFilter => ({
  type: "custom",
  stateKey: "numberRange",
  render: ({ value, onChange }) => (
    <RupeeRange stops={stops} value={value as NumberRange | undefined} onChange={onChange} />
  ),
  summary: (value) => {
    const r = value as NumberRange | undefined;
    if (!r || !(r.min || r.max)) return null;
    return `${rupees(Number(r.min || 0))} – ${r.max ? rupees(Number(r.max)) : "No limit"}`;
  },
});

export const valueRangeFilter = rupeeRangeFilter(VALUE_STOPS);
export const emdRangeFilter = rupeeRangeFilter(EMD_STOPS);

/** A date as text for a column's `text`; empty when there is none. */
export function dateText(value: unknown, pattern = "dd/MM/yyyy"): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : format(date, pattern);
}
