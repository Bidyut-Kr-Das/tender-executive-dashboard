/**
 * Self-check for the table's row grouping. Run it with:
 *
 *   npx tsx components/v2/data-table/group-rows.check.ts
 */
import assert from "node:assert/strict";
import { groupRows } from "./types";

const key = (row: { docket: string }) => row.docket;
const rows = ["A", "A", "B", "A", "C", "C", "C"].map((docket) => ({ docket }));

// Only consecutive rows join: the second run of "A" is its own group.
assert.deepEqual(groupRows(rows, key), [
  { start: 0, length: 2 },
  { start: 2, length: 1 },
  { start: 3, length: 1 },
  { start: 4, length: 3 },
]);

// Without a key every row stands alone, so an ungrouped table is unchanged.
assert.deepEqual(
  groupRows(rows),
  rows.map((_, start) => ({ start, length: 1 })),
);

assert.deepEqual(groupRows([], key), []);

console.log("group-rows: ok");
