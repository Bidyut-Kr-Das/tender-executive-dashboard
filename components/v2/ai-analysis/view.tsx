"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceStrict } from "date-fns";
import { signIn, useSession } from "next-auth/react";
import { toast } from "sonner";
import { AlertTriangle, Check, Clock, LogIn, Radio, RefreshCw, RotateCcw } from "lucide-react";
import { requeueStage } from "@/actions/ai-analysis";
import { fetchLifecycleCounts } from "@/actions/tender-lifecycle";
import {
  LIFECYCLE_SLOW_MS as SLOW_MS,
  lifecycleFunnel,
  type LifecycleCounts,
  type LifecycleFunnelRow,
} from "@/lib/tender-lifecycle";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/v2/ui/button";
import { describeError } from "@/components/v2/ui/errors";
import { Badge, Dash } from "@/components/v2/ui/field";
import { EmptyState, Page, PageHeader, PageSkeleton } from "@/components/v2/ui/page";

const POLL_MS = 5_000;

type RequeueFrom = Parameters<typeof requeueStage>[1];

const STAGES: Record<LifecycleFunnelRow["stage"], { label: string; detail: string }> = {
  RELEVANCE: { label: "Relevance", detail: "AI checks the tender is relevant" },
  AUTOMATION: { label: "Documents", detail: "Tender files are downloaded" },
  INGESTION: { label: "Ingestion", detail: "The agent reads the files" },
  INTELLIGENCE: { label: "Report", detail: "The agent writes its report" },
};

const fmt = (n: number) => n.toLocaleString("en-IN");
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Shown while no tender has been queued, so the layout can be judged.
// Delete with `sample` below once real statuses exist.
function sampleCounts(now: Date): LifecycleCounts {
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  return {
    stages: [
      { stage: "RELEVANCE", queued: 46, failed: 2, oldestQueued: ago(4) },
      { stage: "AUTOMATION", queued: 31, failed: 4, oldestQueued: ago(22) },
      { stage: "INGESTION", queued: 18, failed: 1, oldestQueued: ago(95) },
      { stage: "INTELLIGENCE", queued: 12, failed: 3, oldestQueued: ago(38) },
    ],
    completed: 214,
    rejected: 389,
    notStarted: 12_840,
    parsing: { pending: 27, completed: 512, failed: 9 },
  };
}

/** Loads once signed in; with `live` on, again every five seconds. */
function useLifecycleCounts(signedIn: boolean) {
  const [counts, setCounts] = useState<LifecycleCounts | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    // A slow answer must not pile requests up behind it: this tick is skipped.
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      setCounts(await fetchLifecycleCounts());
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(await describeError(err));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  // The action rejects a signed-out caller, so it is not called at all.
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  useEffect(() => {
    if (!live || !signedIn) return;
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [live, signedIn, load]);

  return { counts, updatedAt, error, loading, live, setLive, load };
}

interface Part {
  label: string;
  value: number;
  /** Background class of the bar segment and the legend dot. */
  fill: string;
}

/** Parts of a whole on one line. Empty parts take no room. */
function SegmentBar({ parts, className }: { parts: Part[]; className?: string }) {
  return (
    <div
      role="img"
      aria-label={parts.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}
      className={cn("flex gap-px overflow-hidden rounded-full bg-sunken", className)}
    >
      {parts.map(
        (p) =>
          p.value > 0 && (
            <span
              key={p.label}
              title={`${p.label}: ${fmt(p.value)}`}
              style={{ flexGrow: p.value }}
              className={cn(
                "min-w-0.5 basis-0 transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none",
                p.fill,
              )}
            />
          ),
      )}
    </div>
  );
}

function Legend({ parts }: { parts: Part[] }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2">
      {parts.map((p) => (
        <div key={p.label} className="flex flex-col">
          <dt className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className={cn("size-2 rounded-full", p.fill)} aria-hidden />
            {p.label}
          </dt>
          <dd className="type-stat tabular-nums">{fmt(p.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="hairline shrink-0 rounded-xl bg-surface">
      <header className="flex min-h-9 flex-wrap items-center gap-x-3 px-4">
        <h2 className="font-medium">{title}</h2>
        {aside && <span className="ml-auto text-xs text-ink-3">{aside}</span>}
      </header>
      <div className="border-t">{children}</div>
    </section>
  );
}

const TH = "type-label px-3 py-1.5 text-right font-medium text-ink-3";
const TD = "px-3 py-2.5 text-right align-middle tabular-nums";

/** One line per stage; the bar shrinks as tenders drop out before it. */
function Pipeline({
  rows,
  entered,
  completed,
  now,
  onRequeue,
  requeuing,
}: {
  rows: LifecycleFunnelRow[];
  entered: number;
  completed: number;
  now: Date;
  /** Developers only: send a stage's failed or slow tenders through it again. */
  onRequeue?: (stage: LifecycleFunnelRow["stage"], from: RequeueFrom) => void;
  /** `${stage}_${from}` of the requeue in flight. */
  requeuing: string | null;
}) {
  const requeueButton = (row: LifecycleFunnelRow, from: RequeueFrom, label: string) =>
    onRequeue && (
      <IconButton
        size="sm"
        label={label}
        disabled={requeuing !== null}
        onClick={() => onRequeue(row.stage, from)}
      >
        <RotateCcw
          className={cn(
            "size-3.5",
            requeuing === `${row.stage}_${from}` &&
              "animate-spin [animation-direction:reverse] motion-reduce:animate-none",
          )}
        />
      </IconButton>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-separate border-spacing-0">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pl-4 text-left")}>
              Stage
            </th>
            <th scope="col" className={cn(TH, "w-[34%] text-left")}>
              Share of queued tenders
            </th>
            <th scope="col" className={TH}>
              Waiting
            </th>
            <th scope="col" className={TH}>
              Failed
            </th>
            <th scope="col" className={TH}>
              Moved on
            </th>
            <th scope="col" className={cn(TH, "pr-4")}>
              Longest wait
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const { label, detail } = STAGES[row.stage];
            const waited = row.oldestQueued
              ? now.getTime() - new Date(row.oldestQueued).getTime()
              : 0;
            const slow = waited > SLOW_MS;
            return (
              <tr key={row.stage}>
                <th scope="row" className="border-t py-2.5 pl-4 pr-3 text-left font-normal">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sunken text-3xs font-semibold tabular-nums text-ink-2">
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-ink-3">
                        {detail}
                        {row.rejected > 0 && ` · ${fmt(row.rejected)} rejected`}
                      </span>
                    </span>
                  </div>
                </th>
                <td className="border-t px-3 py-2.5 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <SegmentBar
                        className="h-2 bg-transparent"
                        parts={[
                          { label: "Moved on", value: row.passed, fill: "bg-good/40" },
                          { label: "Waiting", value: row.queued, fill: "bg-accent" },
                          { label: "Failed", value: row.failed, fill: "bg-bad" },
                          { label: "Rejected", value: row.rejected, fill: "bg-ink-3/50" },
                          // The rest of the line: tenders that never got this far.
                          { label: "Not reached", value: entered - row.reached, fill: "bg-sunken" },
                        ]}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ink-3">
                      {percent(row.reached, entered)}%
                    </span>
                  </div>
                </td>
                <td className={cn(TD, "border-t text-md font-semibold")}>
                  {row.queued > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      {fmt(row.queued)}
                      {slow &&
                        requeueButton(
                          row,
                          "QUEUED",
                          `Requeue tenders waiting over ${formatDistanceStrict(0, SLOW_MS)} in ${label}`,
                        )}
                    </span>
                  ) : (
                    <span className="font-normal text-ink-3">0</span>
                  )}
                </td>
                <td className={cn(TD, "border-t")}>
                  {row.failed > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Badge tone="bad">{fmt(row.failed)}</Badge>
                      {requeueButton(row, "FAILED", `Requeue ${fmt(row.failed)} failed in ${label}`)}
                    </span>
                  ) : (
                    <span className="text-ink-3">0</span>
                  )}
                </td>
                <td className={cn(TD, "border-t text-ink-2")}>{fmt(row.passed)}</td>
                <td className={cn(TD, "border-t pr-4")}>
                  {row.oldestQueued ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        slow ? "font-medium text-warn" : "text-ink-2",
                      )}
                    >
                      {slow && <Clock className="size-3" aria-hidden />}
                      {formatDistanceStrict(new Date(row.oldestQueued), now)}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </td>
              </tr>
            );
          })}
          <tr>
            <th scope="row" className="border-t py-2.5 pl-4 pr-3 text-left font-normal">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-good-soft text-good">
                  <Check className="size-3" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">Completed</span>
                  <span className="text-xs text-ink-3">Report saved on the tender</span>
                </span>
              </div>
            </th>
            <td className="border-t px-3 py-2.5 align-middle">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SegmentBar
                    className="h-2 bg-transparent"
                    parts={[
                      { label: "Completed", value: completed, fill: "bg-good" },
                      { label: "Not reached", value: entered - completed, fill: "bg-sunken" },
                    ]}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ink-3">
                  {percent(completed, entered)}%
                </span>
              </div>
            </td>
            <td className={cn(TD, "border-t text-md font-semibold text-good")} colSpan={4}>
              <span className="pr-1">{fmt(completed)} completed</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function AiAnalysisView() {
  const { data: session, status } = useSession();
  const { counts: loaded, updatedAt, error, loading, live, setLive, load } = useLifecycleCounts(
    status === "authenticated",
  );
  const developer = session?.user?.role === "developer";
  const [requeuing, setRequeuing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const requeue = (stage: LifecycleFunnelRow["stage"], from: RequeueFrom) => {
    setRequeuing(`${stage}_${from}`);
    toast.promise(
      requeueStage(stage, from).finally(() => {
        setRequeuing(null);
        load();
      }),
      {
        loading: `Requeueing ${from === "FAILED" ? "failed" : "slow"} tenders in ${STAGES[stage].label}...`,
        success: ({ queued, notQueued }) =>
          notQueued > 0
            ? `${fmt(queued)} requeued, ${fmt(notQueued)} could not be queued`
            : `${fmt(queued)} requeued`,
        error: async (err) => `Requeue failed: ${await describeError(err)}`,
      },
    );
  };

  // Hold the spinner for five seconds so a fast refresh is still visible.
  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 5_000);
    load();
  };

  if (status === "unauthenticated") {
    return (
      <Page className="items-center justify-center">
        <EmptyState
          icon={LogIn}
          title="Sign in to see AI analysis status"
          action={<Button onClick={() => signIn()}>Sign in</Button>}
        />
      </Page>
    );
  }

  if (!loaded || !updatedAt) {
    if (!error) return <PageSkeleton label="AI analysis" />;
    return (
      <Page className="items-center justify-center">
        <EmptyState
          icon={AlertTriangle}
          tone="bad"
          title="Could not load AI analysis status"
          description={error}
          action={<Button onClick={load}>Try again</Button>}
        />
      </Page>
    );
  }

  const sample = lifecycleFunnel(loaded).entered === 0;
  const counts = sample ? sampleCounts(updatedAt) : loaded;
  const { rows, entered } = lifecycleFunnel(counts);

  const inProgress = rows.reduce((sum, r) => sum + r.queued, 0);
  const failed = rows.reduce((sum, r) => sum + r.failed, 0);
  const finished = counts.completed + counts.rejected;
  const overall: Part[] = [
    { label: "Completed", value: counts.completed, fill: "bg-good" },
    { label: "Rejected", value: counts.rejected, fill: "bg-ink-3" },
    { label: "In progress", value: inProgress, fill: "bg-accent" },
    { label: "Failed", value: failed, fill: "bg-bad" },
  ];
  const parsing: Part[] = [
    { label: "Parsed", value: counts.parsing.completed, fill: "bg-good" },
    { label: "Pending", value: counts.parsing.pending, fill: "bg-accent" },
    { label: "Failed", value: counts.parsing.failed, fill: "bg-bad" },
  ];

  return (
    <Page className="overflow-y-auto">
      <PageHeader
        title="AI Analysis"
        meta={
          <span className="inline-flex items-center gap-2">
            {live && (
              <span className="inline-flex items-center gap-1.5 text-good">
                <span className="size-1.5 animate-pulse rounded-full bg-good motion-reduce:animate-none" />
                Live
              </span>
            )}
            Updated {updatedAt.toLocaleTimeString("en-IN")}
            {sample && <Badge tone="warn">Sample data</Badge>}
          </span>
        }
        actions={
          <>
            <Button
              aria-pressed={live}
              icon={<Radio className="size-3.5" />}
              className={cn(live && "bg-accent-soft text-accent-ink")}
              onClick={() => setLive(!live)}
            >
              Live update {live ? "on" : "off"}
            </Button>
            <Button
              icon={<RefreshCw className="size-3.5" />}
              // Live ticks would flicker the spinner every five seconds.
              loading={refreshing || (loading && !live)}
              onClick={refresh}
            >
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="text-bad">
          Last update failed: {error}
        </p>
      )}

      <section className="hairline flex shrink-0 flex-col gap-4 rounded-xl bg-surface p-4">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div className="flex flex-col">
            <span className="text-xs text-ink-2">Finished</span>
            <span className="flex items-baseline gap-2.5">
              <span className="text-4xl font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {percent(finished, entered)}%
              </span>
              <span className="tabular-nums text-ink-2">
                {fmt(finished)} of {fmt(entered)} queued tenders
              </span>
            </span>
          </div>
          <div className="ml-auto">
            <Legend parts={overall} />
          </div>
        </div>
        <SegmentBar parts={overall} className="h-2.5" />
        <p className="text-xs tabular-nums text-ink-3">
          {fmt(counts.notStarted)} tenders are not in the pipeline and are not counted above.
        </p>
      </section>

      <Panel
        title="Pipeline"
        aside={`A wait over ${formatDistanceStrict(0, SLOW_MS)} is marked as slow`}
      >
        <Pipeline
          rows={rows}
          entered={entered}
          completed={counts.completed}
          now={updatedAt}
          // Sample rows have nothing behind them to requeue.
          onRequeue={developer && !sample ? requeue : undefined}
          requeuing={requeuing}
        />
      </Panel>

      <Panel title="File parsing" aside="Per file, alongside ingestion">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-3 p-4">
          <Legend parts={parsing} />
          <SegmentBar parts={parsing} className="h-2 min-w-48 flex-1" />
        </div>
      </Panel>
    </Page>
  );
}
