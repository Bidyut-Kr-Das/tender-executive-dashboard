// Pure helpers for the result sync webhook (app/api/webhook/result). No DB access here.

export const COMPETITORS_SEPARATOR = " - ";

export interface ResultRow {
  referenceNo: string;
  reverseAuction?: unknown;
  l1?: unknown;
  isLaser?: unknown;
  contractValue?: unknown;
  competitors?: unknown;
  currentStatus?: unknown;
}

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Appends names not already in the stored " - " separated list. Returns null when nothing is new.
export function mergeCompetitors(existing: string | null | undefined, incoming: string[]): string | null {
  const current = (existing ?? "").trim();
  const seen = new Set(current ? current.split(COMPETITORS_SEPARATOR).map((s) => s.trim()).filter(Boolean) : []);
  const toAdd = incoming.map((s) => s.trim()).filter((s) => s && !seen.has(s) && seen.add(s));
  if (!toAdd.length) return null;
  const added = toAdd.join(COMPETITORS_SEPARATOR);
  return current ? `${current}${COMPETITORS_SEPARATOR}${added}` : added;
}

export function parseResultRows(result: unknown): ResultRow[] {
  const rows = (result as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) throw httpError("data.result.rows must be an array", 400);
  return rows.map((r, i) => {
    const referenceNo = text(r?.referenceNo);
    if (!referenceNo) throw httpError(`data.result.rows[${i}].referenceNo is required`, 400);
    return { ...r, referenceNo };
  });
}

// Maps one result row onto tender_merged columns. Empty values never overwrite stored data.
export function buildResultUpdate(row: ResultRow, existingCompetitors: string | null): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const l1 = text(row.l1);
  const contractValue = text(row.contractValue);
  const currentStatus = text(row.currentStatus);

  if (typeof row.reverseAuction === "boolean") data.reverseAuctionApplicable = row.reverseAuction;
  if (l1) data.nameOfRank1 = l1;
  if (contractValue) data.valueOfRank1 = contractValue;
  if (row.isLaser === true) {
    data.ourRank = "1";
    if (contractValue) data.ourValue = contractValue;
  }
  if (currentStatus) data.currentStatus = currentStatus;

  const competitors = mergeCompetitors(existingCompetitors, text(row.competitors).split(","));
  if (competitors) data.competitors = competitors;

  return data;
}
