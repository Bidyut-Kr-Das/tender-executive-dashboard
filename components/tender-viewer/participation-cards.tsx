"use client";

import type { ParticipationFilter } from "@/lib/slices/filtersSlice";

function isParticipatedRow(row: Record<string, unknown>): boolean {
  return row.apm === "YES" && row.participated === "true";
}

function isParticipatedTotalRow(row: Record<string, unknown>): boolean {
  return row.apm === "YES" && row.participated === "true";
}

function isRaDoneRow(row: Record<string, unknown>): boolean {
  return (
    row.participated === "true" &&
    row.reverseAuctionApplicable === "true" &&
    !!row.reverseAuctionStartDate &&
    !!row.reverseAuctionEndDate
  );
}

function isRaPendingRow(row: Record<string, unknown>): boolean {
  return (
    row.participated === "true" &&
    row.reverseAuctionApplicable === "true" &&
    (!row.reverseAuctionStartDate || !row.reverseAuctionEndDate)
  );
}

/**
 * ourRank is free text and the sheet records a first place as either "1" or
 * "L1". Mirrors RANK_1 in lib/tender-query, which scripts/tenderQueryParity
 * compares this against.
 */
function isRank1(row: Record<string, unknown>): boolean {
  const rank = String(row.ourRank ?? "").trim().toUpperCase();
  return rank === "1" || rank === "L1";
}

const TECHNICAL_OPEN_STATUSES = [
  "AWARDED",
  "FINANCIAL EVALUATION",
  "TENDER CANCELLED",
  "TECHNICAL BID OPENED",
];

function isTechnicalOpenRow(row: Record<string, unknown>): boolean {
  if (row.participated !== "true") return false;
  const status = String(row.currentStatus ?? "").toUpperCase();
  return TECHNICAL_OPEN_STATUSES.includes(status);
}

function isTechnicalNotOpenRow(row: Record<string, unknown>): boolean {
  if (row.participated !== "true") return false;
  const raw = row.currentStatus;
  if (raw == null) return true;
  const status = String(raw).trim();
  if (status === "") return true;
  return status.toUpperCase() === "NOT EVALUATED";
}

const FINANCIAL_OPEN_STATUSES = [
  "AWARDED",
  "FINANCIAL EVALUATION",
  "TENDER CANCELLED",
];

function isFinancialOpenRow(row: Record<string, unknown>): boolean {
  if (row.participated !== "true") return false;
  const status = String(row.currentStatus ?? "").trim().toUpperCase();
  return FINANCIAL_OPEN_STATUSES.includes(status);
}

function isFinancialNotOpenRow(row: Record<string, unknown>): boolean {
  if (row.participated !== "true") return false;
  if (row.reverseAuctionApplicable === "true") return false;
  const status = String(row.currentStatus ?? "").trim().toUpperCase();
  if (!TECHNICAL_OPEN_STATUSES.includes(status)) return false;
  return !FINANCIAL_OPEN_STATUSES.includes(status);
}

function isWeL1Row(row: Record<string, unknown>): boolean {
  return (
    row.participated === "true" &&
    isRank1(row)
  );
}

function isWeLostRow(row: Record<string, unknown>): boolean {
  return (
    row.participated === "true" &&
    !isRank1(row)
  );
}

function isExpRaDateRow(row: Record<string, unknown>): boolean {
  return (
    row.participated === "true" &&
    row.reverseAuctionApplicable === "true" &&
    (!row.reverseAuctionStartDate || !row.reverseAuctionEndDate) &&
    row.expectedRaDate != null &&
    String(row.expectedRaDate).trim() !== ""
  );
}

function isContractReceivedRow(row: Record<string, unknown>): boolean {
  return (
    row.participated === "true" &&
    isRank1(row) &&
    row.contractNo != null &&
    String(row.contractNo).trim() !== ""
  );
}

function isContractPendingRow(row: Record<string, unknown>): boolean {
  return (
    row.participated === "true" &&
    isRank1(row) &&
    (row.contractNo == null || String(row.contractNo).trim() === "")
  );
}

/**
 * Financial-branch variants of the We L1 / We Lost / contract nodes.
 *
 * The plain isWeL1Row/isContractReceivedRow predicates are branch-agnostic -
 * they only produce branch-correct results because the flow chart AND-s them
 * with their whole ancestor chain. These four are self-contained so the two
 * subtrees of the flow chart can be selected independently of each other.
 */
function isFinancialBranchRow(row: Record<string, unknown>): boolean {
  if (row.participated !== "true") return false;
  if (row.reverseAuctionApplicable === "true") return false;
  const status = String(row.currentStatus ?? "").trim().toUpperCase();
  return FINANCIAL_OPEN_STATUSES.includes(status);
}

function isFinancialWeL1Row(row: Record<string, unknown>): boolean {
  return isFinancialBranchRow(row) && isRank1(row);
}

function isFinancialWeLostRow(row: Record<string, unknown>): boolean {
  return isFinancialBranchRow(row) && !isRank1(row);
}

function isFinancialContractReceivedRow(
  row: Record<string, unknown>,
): boolean {
  return (
    isFinancialWeL1Row(row) &&
    row.contractNo != null &&
    String(row.contractNo).trim() !== ""
  );
}

function isFinancialContractPendingRow(
  row: Record<string, unknown>,
): boolean {
  return (
    isFinancialWeL1Row(row) &&
    (row.contractNo == null || String(row.contractNo).trim() === "")
  );
}

function isNotParticipatedRow(
  row: Record<string, unknown>,
): boolean {
  return (
    row.apm === "YES" &&
    row.participated !== "true" &&
    row.participated !== "false"
  );
}

function isUpcomingRaRow(
  row: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  if (row.reverseAuctionApplicable !== "true") return false;
  const start = String(row.reverseAuctionStartDate ?? "");
  if (!start) return false;
  const date = new Date(start);
  if (isNaN(date.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date >= today;
}

function isParticipatedWithRaRow(row: Record<string, unknown>): boolean {
  return row.participated === "true" && row.reverseAuctionApplicable === "true";
}

function isParticipatedWithoutRaRow(row: Record<string, unknown>): boolean {
  return row.participated === "true" && row.reverseAuctionApplicable !== "true";
}

function isYetToOpenRaRow(
  row: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  if (row.participated !== "true") return false;
  if (row.reverseAuctionApplicable !== "true") return false;
  const start = String(row.reverseAuctionStartDate ?? "");
  if (!start) return false;
  const date = new Date(start);
  if (isNaN(date.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date > today;
}

function isBidOpeningPendingExclRaRow(row: Record<string, unknown>): boolean {
  if (row.participated !== "true") return false;
  if (row.reverseAuctionApplicable === "true") return false;
  const status = String(row.currentStatus ?? "").toUpperCase();
  if (status === "AWARDED" || status === "FINANCIAL EVALUATION") return false;
  return true;
}

type ParticipationPredicate = (row: Record<string, unknown>) => boolean;

/**
 * Exhaustive map from filter key to predicate. Declared as a full Record so
 * that adding a member to ParticipationFilter is a compile error until it is
 * handled here - the previous if-chain fell through to `return true`, which
 * made a forgotten key silently match every row.
 */
const PARTICIPATION_PREDICATES: Record<
  ParticipationFilter,
  ParticipationPredicate
> = {
  participated: isParticipatedRow,
  participatedTotal: isParticipatedTotalRow,
  notParticipated: isNotParticipatedRow,
  upcomingRa: isUpcomingRaRow,
  participatedWithRa: isParticipatedWithRaRow,
  participatedWithoutRa: isParticipatedWithoutRaRow,
  yetToOpenRa: isYetToOpenRaRow,
  bidOpeningPendingExclRa: isBidOpeningPendingExclRaRow,
  raDone: isRaDoneRow,
  raPending: isRaPendingRow,
  technicalOpen: isTechnicalOpenRow,
  technicalNotOpen: isTechnicalNotOpenRow,
  weL1: isWeL1Row,
  weLost: isWeLostRow,
  expRaDate: isExpRaDateRow,
  contractReceived: isContractReceivedRow,
  contractPending: isContractPendingRow,
  financialOpen: isFinancialOpenRow,
  financialNotOpen: isFinancialNotOpenRow,
  financialWeL1: isFinancialWeL1Row,
  financialWeLost: isFinancialWeLostRow,
  financialContractReceived: isFinancialContractReceivedRow,
  financialContractPending: isFinancialContractPendingRow,
};

function matchesSingleFilter(
  row: Record<string, unknown>,
  filter: ParticipationFilter,
): boolean {
  const predicate = PARTICIPATION_PREDICATES[filter];
  return predicate ? predicate(row) : true;
}

export function matchesParticipationFilter(
  row: Record<string, unknown>,
  filters: ParticipationFilter[],
): boolean {
  if (filters.length === 0) return true;
  return filters.every((f) => matchesSingleFilter(row, f));
}

