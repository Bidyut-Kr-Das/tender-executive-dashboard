"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { layoutFlow } from "@/components/participation-flow/layout";
import { FLOW_TREES, flatten, type FlowNode } from "@/components/participation-flow/tree";
import { cn } from "@/lib/utils";
import { Button } from "@/components/v2/ui/button";
import { Dash } from "@/components/v2/ui/field";
import { activePath, pressNode, toneOf, type FlowFilter, type FlowTone } from "./flow";

const SIZE = { width: 148, height: 38, colGap: 22, rowGap: 3 };

const STORAGE_KEY = "v2-flow-band";

const COUNT_TONE: Record<FlowTone, string> = {
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
  neutral: "text-ink",
};
const BAR_TONE: Record<FlowTone, string> = {
  good: "bg-good",
  bad: "bg-bad",
  warn: "bg-warn",
  neutral: "bg-ink-3",
};

const number = (n: number) => n.toLocaleString("en-IN");

type Counts = Partial<Record<FlowFilter, number>> | null;

function Tree({
  tree,
  counts,
  active,
  onPress,
}: {
  tree: FlowNode;
  counts: Counts;
  active: FlowFilter[];
  onPress: (node: FlowNode) => void;
}) {
  const layout = useMemo(() => layoutFlow(tree, SIZE), [tree]);
  const parents = useMemo(() => {
    const out: Record<string, FlowNode> = {};
    for (const node of flatten(tree)) for (const kid of node.children ?? []) out[kid.id] = node;
    return out;
  }, [tree]);
  const on = new Set(layout.nodes.filter((p) => active.includes(p.node.filter)).map((p) => p.node.id));
  // Drawn last, so a highlighted edge is never under a plain one.
  const edges = [...layout.edges].sort((a, b) => Number(on.has(a.childId)) - Number(on.has(b.childId)));

  return (
    <div className="relative shrink-0" style={{ width: layout.width, height: layout.height }}>
      <svg
        width={layout.width}
        height={layout.height}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.path}
            fill="none"
            stroke={on.has(edge.childId) ? "var(--accent)" : "var(--line-strong)"}
            strokeWidth={on.has(edge.childId) ? 1.75 : 1}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {layout.nodes.map(({ node, x, y, width, height }) => {
        const count = counts ? (counts[node.filter] ?? 0) : null;
        const parent = parents[node.id];
        const parentCount = parent && counts ? (counts[parent.filter] ?? 0) : 0;
        const share = count !== null && parentCount > 0 ? Math.round((count / parentCount) * 100) : null;
        const selected = on.has(node.id);
        const tone = toneOf(node);
        return (
          <button
            key={node.id}
            type="button"
            aria-pressed={selected}
            title={
              share === null ? undefined : `${share}% of ${parent.label.toLowerCase()}`
            }
            onClick={() => onPress(node)}
            style={{ left: x, top: y, width, height }}
            className={cn(
              "press absolute flex flex-col justify-center gap-1 rounded-lg px-2 text-left",
              selected
                ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]"
                : "hairline not-disabled:hover:bg-hover bg-surface",
              count === 0 && !selected && "opacity-55",
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate text-xs", selected ? "text-accent-ink" : "text-ink-2")}>
                {node.label}
              </span>
              <span className={cn("text-xs font-semibold tabular-nums", COUNT_TONE[tone])}>
                {count === null ? <Dash /> : number(count)}
              </span>
            </span>
            {/* Share of the stage before it. */}
            <span className="h-0.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
              <span
                className={cn("block h-full rounded-full", BAR_TONE[tone])}
                style={{ width: `${share ?? (parent ? 0 : 100)}%` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The participation funnel above the table. Pressing a stage filters the table
 * to it; the counts are the stage totals and do not follow the table's filters.
 * Memoised: its props change only when a count or the path does.
 */
export const FlowBand = memo(function FlowBand({
  counts,
  active,
  onChange,
}: {
  /** Dockets per stage, null until the first answer. */
  counts: Counts;
  active: FlowFilter[];
  onChange: (next: FlowFilter[]) => void;
}) {
  const [open, setOpen] = useState(true);
  // After mount: the server render has no storage to read.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "closed") setOpen(false);
    } catch {}
  }, []);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(STORAGE_KEY, open ? "closed" : "open");
    } catch {}
  };

  const path = activePath(active);
  const last = path.at(-1);
  const total = last ? counts?.[last.filter] : counts?.participated;

  return (
    <section aria-label="Participation flow" className="hairline shrink-0 rounded-xl bg-surface">
      <div className="flex h-9 items-center gap-2 pl-3 pr-1.5">
        <h2 className="font-medium">Flow</h2>
        <span className="min-w-0 truncate text-ink-2">
          {path.length > 0 ? path.map((n) => n.label).join(" > ") : "All participated"}
          {total != null && <span className="tabular-nums text-ink-3"> · {number(total)} dockets</span>}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {path.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={open}
            icon={open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            onClick={toggle}
          >
            {open ? "Hide" : "Show"}
          </Button>
        </div>
      </div>
      {open && (
        // Side by side when both trees fit; stacked and scrolled when they do not.
        <div className="flex max-h-[40vh] flex-wrap gap-x-10 gap-y-4 overflow-auto border-t p-3">
          {FLOW_TREES.map(({ tree }) => (
            <Tree
              key={tree.id}
              tree={tree}
              counts={counts}
              active={active}
              onPress={(node) => onChange(pressNode(active, tree, node))}
            />
          ))}
        </div>
      )}
    </section>
  );
});
