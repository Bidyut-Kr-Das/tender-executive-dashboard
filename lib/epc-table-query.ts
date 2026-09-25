import type { EpcTableFilters } from "@/components/TenderTable";
import type { ColumnFilterState } from "@/lib/types";
import { normalizeEpcSelectTokens } from "@/lib/epc-column-map";

/**
 * Turns the filter widgets TenderTable owns into the ColumnFilterState map the
 * SQL layer reads. One copy, shared by the three EPC dashboards, so a filter
 * cannot mean one thing on / and another on /not-participated.
 */

export interface EpcQueryFilterInput {
  table: EpcTableFilters | null;
  /** Sidebar controls, which live outside the table. */
  priceBasis?: string;
  aluminiumMin?: string;
  aluminiumMax?: string;
  copperMin?: string;
  copperMax?: string;
  /** An extra deadline window ANDed with the table's own (participatedDateRange). */
  deadlineFrom?: string;
  deadlineTo?: string;
}

export interface EpcQueryFilters {
  columnFilters: Record<string, ColumnFilterState>;
  erpItemCategory: string | null;
  priceBasis: string | null;
}

function nonEmpty(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Two windows ANDed: the later start and the earlier end win. */
function intersect(a: string, b: string, pick: "max" | "min"): string {
  if (!a) return b;
  if (!b) return a;
  if (pick === "max") return a > b ? a : b;
  return a < b ? a : b;
}

function setDateRange(
  out: Record<string, ColumnFilterState>,
  accessor: string,
  from: string,
  to: string,
) {
  if (!from && !to) return;
  out[accessor] = { ...out[accessor], dateRange: { startDate: from, endDate: to } };
}

export function buildEpcQueryFilters(input: EpcQueryFilterInput): EpcQueryFilters {
  const out: Record<string, ColumnFilterState> = {};
  const t = input.table;

  if (t) {
    for (const [accessor, values] of Object.entries(t.multiSelectFilters)) {
      if (!values || values.length === 0) continue;
      out[accessor] = {
        ...out[accessor],
        select: normalizeEpcSelectTokens(accessor, values),
      };
    }

    for (const [accessor, text] of Object.entries(t.columnSearchText)) {
      const trimmed = nonEmpty(text);
      if (!trimmed) continue;
      out[accessor] = { ...out[accessor], text: trimmed };
    }

    // A preset replaces the explicit window, exactly as getDateRange did.
    if (t.datePreset) {
      out.lastDateOfSubmission = {
        ...out.lastDateOfSubmission,
        select: [t.datePreset],
      };
    } else {
      setDateRange(
        out,
        "lastDateOfSubmission",
        intersect(nonEmpty(t.startDate), nonEmpty(input.deadlineFrom), "max"),
        intersect(nonEmpty(t.endDate), nonEmpty(input.deadlineTo), "min"),
      );
    }

    setDateRange(
      out,
      "reverseAuctionStartDate",
      nonEmpty(t.raStartFrom),
      nonEmpty(t.raStartTo),
    );
    setDateRange(
      out,
      "reverseAuctionEndDate",
      nonEmpty(t.raEndFrom),
      nonEmpty(t.raEndTo),
    );

    if (nonEmpty(t.remarksTextFilter)) {
      out.remarks = { ...out.remarks, text: t.remarksTextFilter.trim() };
    }
    if (t.remarksDropdownFilter && t.remarksDropdownFilter !== "All") {
      out.remarks = { ...out.remarks, select: [t.remarksDropdownFilter] };
    }
    if (nonEmpty(t.proposedErpItemTextFilter)) {
      out.proposedErpItemName = {
        ...out.proposedErpItemName,
        text: t.proposedErpItemTextFilter.trim(),
      };
    }
  } else {
    // Before the table has reported its state, the page's own window still applies.
    setDateRange(
      out,
      "lastDateOfSubmission",
      nonEmpty(input.deadlineFrom),
      nonEmpty(input.deadlineTo),
    );
  }

  const aluMin = nonEmpty(input.aluminiumMin);
  const aluMax = nonEmpty(input.aluminiumMax);
  const cuMin = nonEmpty(input.copperMin);
  const cuMax = nonEmpty(input.copperMax);
  if (aluMin || aluMax || cuMin || cuMax) {
    out.rawMaterials = { rawMaterials: { aluMin, aluMax, cuMin, cuMax } };
  }

  const category = t?.proposedErpItemCategoryFilter;
  const basis = nonEmpty(input.priceBasis);

  return {
    columnFilters: out,
    erpItemCategory: category && category !== "All" ? category : null,
    priceBasis: basis && basis.toLowerCase() !== "all" ? basis : null,
  };
}
