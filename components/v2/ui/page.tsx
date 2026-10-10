import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dash } from "./field";

/** Page frame. The page does not scroll; the table inside it does. */
export function Page({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex h-full flex-col gap-3 p-4", className)} {...rest} />;
}

export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  /** Short live figure beside the title, such as a result count. */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-baseline gap-2.5">
        <h1 className="type-display">{title}</h1>
        {meta != null && (
          <span className="tabular-nums text-ink-2" aria-live="polite">
            {meta}
          </span>
        )}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A headline number. With `onClick` it is a toggle that filters the page. */
export function StatTile({
  label,
  detail,
  value,
  selected = false,
  onClick,
}: {
  label: string;
  detail?: string;
  /** null while the number is not known yet. */
  value: ReactNode | null;
  selected?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    "flex min-w-36 flex-col items-start rounded-xl px-3 py-2 text-left",
    selected ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "hairline bg-surface",
  );
  const content = (
    <>
      <span className="text-xs text-ink-2">
        {label}
        {detail && <span className="text-ink-3"> · {detail}</span>}
      </span>
      <span className="type-stat tabular-nums">{value ?? <Dash />}</span>
    </>
  );
  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn("press", className, !selected && "not-disabled:hover:bg-hover")}
    >
      {content}
    </button>
  );
}

/** Small toggle for a row of quick filters. */
export function Pill({
  selected,
  onClick,
  count,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "press flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs",
        selected
          ? "bg-accent-soft text-accent-ink"
          : "hairline not-disabled:hover:bg-hover bg-surface text-ink-2",
      )}
    >
      {children}
      {count != null && <span className="font-medium tabular-nums text-ink">{count}</span>}
    </button>
  );
}

/** Placeholder block; give it a size with `className`. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-hover motion-reduce:animate-none", className)} />
  );
}

/** Centred message for nothing-to-show and could-not-load. */
export function EmptyState({
  icon: Icon,
  tone = "neutral",
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "bad";
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)}>
      <Icon className={cn("size-5", tone === "bad" ? "text-bad" : "text-ink-3")} aria-hidden />
      <p className="font-medium">{title}</p>
      {description && <p className="text-ink-2">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
