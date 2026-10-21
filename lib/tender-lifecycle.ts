// Tender lifecycle (v2). Source of truth: docs/tender-lifecycle.md — keep both in sync.
// Stored in TenderMerged.lifecycleStatus by setLifecycleStatus (lib/tender-lifecycle-store.ts).
import { QUEUES } from "@/lib/queue/config";

export const TENDER_LIFECYCLE_STATUS = {
  NEW: "NEW",
  RELEVANCE_QUEUED: "RELEVANCE_QUEUED",
  RELEVANCE_REJECTED: "RELEVANCE_REJECTED",
  RELEVANCE_FAILED: "RELEVANCE_FAILED",
  AUTOMATION_QUEUED: "AUTOMATION_QUEUED",
  AUTOMATION_FAILED: "AUTOMATION_FAILED",
  INGESTION_QUEUED: "INGESTION_QUEUED",
  INGESTION_FAILED: "INGESTION_FAILED",
  INTELLIGENCE_QUEUED: "INTELLIGENCE_QUEUED",
  INTELLIGENCE_FAILED: "INTELLIGENCE_FAILED",
  COMPLETED: "COMPLETED",
} as const;

export type TenderLifecycleStatus =
  (typeof TENDER_LIFECYCLE_STATUS)[keyof typeof TENDER_LIFECYCLE_STATUS];

// Stages in pipeline order. A stage is "done" when the next main-chain stage is QUEUED (or COMPLETED after intelligence).
// PARSING is a side branch published together with INGESTION by the automation webhook; it has no tender status
// and is tracked per file in TenderFile.parseStatus.
const TENDER_LIFECYCLE_STAGES = [
  {
    stage: "RELEVANCE",
    queue: QUEUES.AGENT_RELEVANCE,
    clientIdEnv: "TENDER_AGENT_RELEVANCE_CLIENT_ID",
    webhook: "/api/webhook/ai-relevance",
  },
  {
    stage: "AUTOMATION",
    queue: QUEUES.AUTOMATION_V2_TASKS,
    clientIdEnv: "TENDER_AUTOMATION_AUTOMATION_CLIENT_ID",
    webhook: "/api/webhook/automation",
  },
  {
    stage: "PARSING",
    queue: QUEUES.AUTOMATION_V2_PARSING,
    clientIdEnv: "TENDER_AUTOMATION_PARSING_CLIENT_ID",
    webhook: "/api/webhook/parsing",
  },
  {
    stage: "INGESTION",
    queue: QUEUES.AGENT_INGESTION,
    clientIdEnv: "TENDER_AGENT_INGESTION_CLIENT_ID",
    webhook: "/api/webhook/ingestion",
  },
  {
    stage: "INTELLIGENCE",
    queue: QUEUES.AGENT_INTELLIGENCE,
    clientIdEnv: "TENDER_AGENT_INTELLIGENCE_CLIENT_ID",
    webhook: "/api/webhook/intelligence",
  },
] as const satisfies readonly {
  stage: string;
  queue: string;
  clientIdEnv: keyof NodeJS.ProcessEnv;
  webhook: string;
}[];

export type TenderLifecycleStage = (typeof TENDER_LIFECYCLE_STAGES)[number]["stage"];

// A tender queued longer than this is shown as slow, and may be requeued by hand.
// ponytail: one threshold for every stage; make it per stage if their normal waits differ.
export const LIFECYCLE_SLOW_MS = 60 * 60 * 1000;

/** One row of a `groupBy` on the status column. */
export interface LifecycleGroup {
  status: string | null;
  count: number;
  /** When the longest-waiting tender in this status got it. */
  oldest: Date | string | null;
}

export interface LifecycleStageCount {
  stage: Exclude<TenderLifecycleStage, "PARSING">;
  queued: number;
  failed: number;
  /** ISO time the longest-waiting queued tender entered the stage; null when none is queued. */
  oldestQueued: string | null;
}

export interface LifecycleCounts {
  stages: LifecycleStageCount[];
  completed: number;
  rejected: number;
  notStarted: number;
  /** Per file, from TenderFile.parseStatus. */
  parsing: { pending: number; completed: number; failed: number };
}

/** Folds grouped status counts into what the AI analysis page shows. */
export function summarizeLifecycle(
  tenders: LifecycleGroup[],
  files: { status: string | null; count: number }[],
): LifecycleCounts {
  const by = new Map(tenders.map((g) => [g.status ?? TENDER_LIFECYCLE_STATUS.NEW, g]));
  const count = (status: string) => by.get(status)?.count ?? 0;
  const fileCount = (status: string) => files.find((f) => f.status === status)?.count ?? 0;
  const known = new Set<string>(Object.values(TENDER_LIFECYCLE_STATUS));

  return {
    stages: TENDER_LIFECYCLE_STAGES.flatMap(({ stage }) => {
      if (stage === "PARSING") return [];
      const oldest = by.get(`${stage}_QUEUED`)?.oldest;
      return {
        stage,
        queued: count(`${stage}_QUEUED`),
        failed: count(`${stage}_FAILED`),
        oldestQueued: oldest ? new Date(oldest).toISOString() : null,
      };
    }),
    completed: count(TENDER_LIFECYCLE_STATUS.COMPLETED),
    rejected: count(TENDER_LIFECYCLE_STATUS.RELEVANCE_REJECTED),
    // A value this code does not know is counted here, not dropped.
    notStarted: tenders
      .filter((g) => !g.status || g.status === "NEW" || !known.has(g.status))
      .reduce((sum, g) => sum + g.count, 0),
    parsing: {
      pending: fileCount("PENDING"),
      completed: fileCount("COMPLETED"),
      failed: fileCount("FAILED"),
    },
  };
}

export interface LifecycleFunnelRow extends LifecycleStageCount {
  /** Tenders that left this stage as not relevant. Relevance only. */
  rejected: number;
  /** Tenders now in a later stage, or completed. */
  passed: number;
  /** Every tender that got as far as this stage. */
  reached: number;
}

/** The stages as a funnel: how many tenders reached each one and how many moved on. */
export function lifecycleFunnel(counts: LifecycleCounts): {
  rows: LifecycleFunnelRow[];
  /** Tenders queued at least once. */
  entered: number;
} {
  const rows: LifecycleFunnelRow[] = [];
  let passed = counts.completed;
  for (const stage of [...counts.stages].reverse()) {
    const rejected = stage.stage === "RELEVANCE" ? counts.rejected : 0;
    const reached = stage.queued + stage.failed + rejected + passed;
    rows.unshift({ ...stage, rejected, passed, reached });
    passed = reached;
  }
  return { rows, entered: passed };
}
