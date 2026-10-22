/**
 * Self-check for buildCountsQuery. Run it with:
 *
 *   pnpm exec tsx lib/epc-table-query.check.ts
 *
 * No database and no React: buildCountsQuery is pure.
 */
import assert from "node:assert/strict";
import { buildCountsQuery } from "@/lib/epc-table-query";
import type { TenderQuery } from "@/lib/tender-query";

let checks = 0;
function check(label: string, fn: () => void) {
  fn();
  checks++;
  void label;
}

const baseQuery: TenderQuery = {
  scope: "postParticipation",
  groupByDocket: true,
  erpItemCategory: null,
  priceBasis: null,
  columnFilters: {},
  participationFilters: [],
  analyticsFilter: null,
  exclusionFilter: null,
  associationFilter: null,
  fileDateFromIso: null,
  fileDateToIso: null,
  applyDefaultDeadlineFilter: false,
  mergedGroups: [],
  sort: null,
  page: 1,
  pageSize: 50,
};

check("counts query drops participation and table filters", () => {
  const out = buildCountsQuery({
    ...baseQuery,
    participationFilters: ["weL1", "technicalOpen"],
    columnFilters: { organisationName: { text: "NTPC" } },
    erpItemCategory: "XLPE Cable",
    priceBasis: "Firm",
    associationFilter: "7",
    analyticsFilter: "aiYes",
    exclusionFilter: "railways",
    fileDateFromIso: "2026-01-01T00:00:00.000Z",
    fileDateToIso: "2026-09-30T23:59:59.999Z",
  });
  assert.deepEqual(out.participationFilters, []);
  assert.equal(out.columnFilters.organisationName, undefined);
  assert.equal(out.erpItemCategory, null);
  assert.equal(out.priceBasis, null);
  assert.equal(out.associationFilter, null);
  assert.equal(out.analyticsFilter, null);
  assert.equal(out.exclusionFilter, null);
  assert.equal(out.fileDateFromIso, null);
  assert.equal(out.fileDateToIso, null);
});

check("counts query keeps the scope and the sidebar deadline window", () => {
  const out = buildCountsQuery(baseQuery, "2026-04-01", "2026-09-30");
  assert.equal(out.scope, "postParticipation");
  assert.equal(out.groupByDocket, true);
  assert.deepEqual(out.columnFilters.lastDateOfSubmission?.dateRange, {
    startDate: "2026-04-01",
    endDate: "2026-09-30",
  });
});

check("no sidebar window leaves columnFilters empty", () => {
  assert.deepEqual(buildCountsQuery(baseQuery).columnFilters, {});
  assert.deepEqual(buildCountsQuery(baseQuery, "", "  ").columnFilters, {});
});

console.log(`epc-table-query: ${checks} checks passed`);
