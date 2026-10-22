/**
 * Self-check for the lifecycle counts. Run it with:
 *
 *   pnpm exec tsx lib/tender-lifecycle.check.ts
 */
import assert from "node:assert/strict";
import { summarizeLifecycle } from "./tender-lifecycle";

const at = new Date("2026-10-11T04:00:00.000Z");
const counts = summarizeLifecycle(
  [
    { status: null, count: 900, oldest: null },
    { status: "NEW", count: 5, oldest: null },
    { status: "SOMETHING_ELSE", count: 2, oldest: null },
    { status: "RELEVANCE_QUEUED", count: 40, oldest: at },
    { status: "RELEVANCE_FAILED", count: 3, oldest: at },
    { status: "RELEVANCE_REJECTED", count: 70, oldest: at },
    { status: "INTELLIGENCE_QUEUED", count: 8, oldest: null },
    { status: "COMPLETED", count: 120, oldest: at },
  ],
  [
    { status: null, count: 300 },
    { status: "PENDING", count: 12 },
    { status: "FAILED", count: 1 },
  ],
  { RELEVANCE: { ready: 2, workers: 1 } },
);

// Main chain only, in pipeline order; parsing is per file.
assert.deepEqual(
  counts.stages.map((s) => s.stage),
  ["RELEVANCE", "AUTOMATION", "INGESTION", "INTELLIGENCE"],
);
assert.deepEqual(counts.stages[0], {
  stage: "RELEVANCE",
  queued: 40,
  failed: 3,
  oldestQueued: at.toISOString(),
  queue: { ready: 2, workers: 1 },
});
assert.deepEqual(counts.stages[1], {
  stage: "AUTOMATION",
  queued: 0,
  failed: 0,
  oldestQueued: null,
  queue: null,
});
assert.equal(counts.stages[3].queued, 8);
assert.equal(counts.completed, 120);
assert.equal(counts.rejected, 70);
// Null, NEW and unknown values all count as not started.
assert.equal(counts.notStarted, 907);
assert.deepEqual(counts.parsing, { pending: 12, completed: 0, failed: 1, notSent: 300 });

// Every tender is counted exactly once.
const total =
  counts.stages.reduce((sum, s) => sum + s.queued + s.failed, 0) +
  counts.completed +
  counts.rejected +
  counts.notStarted;
assert.equal(total, 900 + 5 + 2 + 40 + 3 + 70 + 8 + 120);

console.log("tender-lifecycle: ok");
