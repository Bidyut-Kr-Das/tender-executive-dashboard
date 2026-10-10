import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Dash } from "@/components/v2/ui/field";

/**
 * Cell building blocks for any page's column definitions. Nothing here knows
 * what a row is.
 */

const LINES = { 2: "max-h-[2lh]", 3: "max-h-[3lh]", 4: "max-h-[4lh]" } as const;

/** Content capped at a few lines; the rest scrolls inside the cell, scrollbar hidden. */
export function Clamp({
  children,
  lines = 3,
  className,
  title,
}: {
  children: ReactNode;
  lines?: keyof typeof LINES;
  className?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={cn(
        "no-scrollbar overflow-hidden hover:overflow-y-auto pointer-coarse:overflow-y-auto whitespace-pre-line wrap-break-word",
        LINES[lines],
        className,
      )}
    >
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
