"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { clearParticipationFilters } from "@/lib/slices/filtersSlice";
import { ParticipationFlowChart } from "@/components/ParticipationFlowChart";
import { FLOW_MODE_MIN_WIDTH } from "@/components/participation-flow/layout";
import { SCENARIOS } from "./dummy-counts";
import { Eraser, PanelLeft, Ruler } from "lucide-react";

const WIDTH_PRESETS = [200, 260, 320, 440, 560, 720, 900];

export default function FlowChartPreviewPage() {
  const dispatch = useAppDispatch();
  const participationFilters = useAppSelector(
    (s) => s.filters.participationFilters,
  );

  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0].key);
  const [width, setWidth] = useState(260);

  const scenario =
    SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0];
  const mode = width >= FLOW_MODE_MIN_WIDTH ? "flow" : "rail";

  return (
    <div className="flex-1 overflow-auto bg-muted p-6">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="space-y-1">
          <h1 className="text-xl font-bold text-brand-ink">
            Participation Flow Chart — visual preview
          </h1>
          <p className="text-sm text-muted-foreground">
            Dummy data only. Nothing here touches the tender store or the real
            dashboard.
          </p>
        </header>

        {/* Controls */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <PanelLeft size={13} /> Scenario
            </div>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScenarioKey(s.key)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    s.key === scenarioKey
                      ? "border-blue-300 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-slate-300 dark:hover:border-muted-foreground/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {scenario.description}{" "}
              <span className="font-medium text-foreground/80">
                {Object.keys(scenario.counts).length} nodes
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Ruler size={13} /> Sidebar width
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {WIDTH_PRESETS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWidth(w)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                    w === width
                      ? "border-blue-300 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-slate-300 dark:hover:border-muted-foreground/40"
                  }`}
                >
                  {w}px
                </button>
              ))}
              <input
                type="range"
                min={200}
                max={1000}
                step={10}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="ml-2 w-56 cursor-pointer accent-blue-600"
              />
              <span className="text-xs font-semibold tabular-nums text-foreground/80">
                {width}px
              </span>
              <span
                className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  mode === "flow"
                    ? "bg-violet-100 dark:bg-violet-400/15 text-violet-700 dark:text-violet-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {mode} mode
              </span>
              <span className="text-[11px] text-muted-foreground">
                switches at {FLOW_MODE_MIN_WIDTH}px
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          {/* Live sidebar replica */}
          <div
            className="shrink-0 rounded-lg border border-brand-hover bg-brand shadow-lg"
            style={{ width }}
          >
            <div className="border-b border-brand-hover px-5 py-4 text-[13px] font-bold uppercase tracking-[0.8px] text-brand-foreground">
              Participation Filters
            </div>
            <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
              <ParticipationFlowChart serverCounts={scenario.counts} />
            </div>
          </div>

          {/* Active filter readout */}
          <div className="min-w-[260px] flex-1 space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Active filters ({participationFilters.length})
              </span>
              <button
                type="button"
                onClick={() => dispatch(clearParticipationFilters())}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-slate-300 dark:hover:border-muted-foreground/40 hover:bg-accent"
              >
                <Eraser size={12} /> Clear
              </button>
            </div>
            {participationFilters.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                None. Click a node to select it — ancestors activate with it,
                and clearing a node clears everything below it.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {participationFilters.map((f) => (
                  <span
                    key={f}
                    className="rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-1 font-mono text-[11px] text-blue-800 dark:text-blue-300"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
            <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              The two <span className="font-semibold">We L1</span> nodes now use
              separate filter keys (<code>weL1</code> vs{" "}
              <code>financialWeL1</code>), so selecting one no longer highlights
              the other.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
