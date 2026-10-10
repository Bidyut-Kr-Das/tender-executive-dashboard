"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { DayPicker, type DayPickerProps, type Matcher } from "react-day-picker";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "./field";
import { Popover } from "./overlay";

const NAV_BUTTON =
  "press not-disabled:hover:bg-hover inline-flex size-7 items-center justify-center rounded-md text-ink-2 aria-disabled:opacity-50";

/** Month grid. Takes every react-day-picker prop; styled entirely from v2 tokens. */
export function Calendar(props: DayPickerProps) {
  return (
    <DayPicker
      {...props}
      classNames={{
        root: "w-fit select-none",
        months: "relative flex flex-col gap-3",
        month: "flex flex-col gap-1",
        nav: "absolute right-0 top-0 flex items-center gap-0.5",
        button_previous: NAV_BUTTON,
        button_next: NAV_BUTTON,
        month_caption: "flex h-7 items-center px-1.5 font-medium",
        month_grid: "border-collapse",
        weekday: "size-8 text-xs font-normal text-ink-3",
        day: "p-0 text-center",
        day_button:
          "press size-8 rounded-md tabular-nums not-disabled:hover:bg-hover in-data-[today=true]:edge in-data-[today=true]:font-semibold in-data-[selected=true]:bg-accent in-data-[selected=true]:text-on-accent in-data-[disabled=true]:opacity-50",
        ...props.classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
        ...props.components,
      }}
    />
  );
}

/** One date as `yyyy-MM-dd`, empty when unset. Pressing the selected day clears it. */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Any date",
  min,
  max,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name when the picker is not inside a `Field`. */
  label?: string;
  placeholder?: string;
  /** Earliest and latest selectable days, as `yyyy-MM-dd`. */
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;
  const outOfRange: Matcher[] = [];
  if (min) outOfRange.push({ before: parseISO(min) });
  if (max) outOfRange.push({ after: parseISO(max) });

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="p-2"
      trigger={
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={cn(
            "press edge not-disabled:hover:bg-hover flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-left text-md text-ink disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate tabular-nums", !date && "text-ink-3")}>
            {date ? format(date, "d MMM yyyy") : placeholder}
          </span>
          <CalendarDays className="size-3.5 shrink-0 text-ink-3" aria-hidden />
        </button>
      }
    >
      <Calendar
        mode="single"
        autoFocus
        selected={date}
        defaultMonth={date}
        disabled={outOfRange}
        onSelect={(next) => {
          onChange(next ? format(next, "yyyy-MM-dd") : "");
          setOpen(false);
        }}
      />
    </Popover>
  );
}

/** From and To dates as `yyyy-MM-dd`, empty when unset. Each end limits the other. */
export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="From">
        <DatePicker value={from} max={to || undefined} onChange={(next) => onChange(next, to)} />
      </Field>
      <Field label="To">
        <DatePicker value={to} min={from || undefined} onChange={(next) => onChange(from, next)} />
      </Field>
    </div>
  );
}
