// Type-only: a value import from lib/tender-query drags Prisma into the client bundle.
import type { TenderQuery } from "@/lib/tender-query";

function nonEmpty(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * The sidebar's counts baseline: the scope predicate plus the sidebar's own
 * deadline window, nothing else. Participation filters, every table widget and
 * the sidebar's other controls are stripped, so clicking a flow node cannot
 * change the numbers printed on the flow nodes, and a table filter cannot
 * either. The window is rebuilt from the raw sidebar values.
 */
export function buildCountsQuery(
  query: TenderQuery,
  deadlineFrom?: string,
  deadlineTo?: string,
): TenderQuery {
  const from = nonEmpty(deadlineFrom);
  const to = nonEmpty(deadlineTo);
  return {
    ...query,
    columnFilters:
      from || to
        ? { lastDateOfSubmission: { dateRange: { startDate: from, endDate: to } } }
        : {},
    participationFilters: [],
    analyticsFilter: null,
    exclusionFilter: null,
    associationFilter: null,
    erpItemCategory: null,
    priceBasis: null,
    fileDateFromIso: null,
    fileDateToIso: null,
  };
}
