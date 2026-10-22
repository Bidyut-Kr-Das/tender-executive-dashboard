import { sheets as googleSheets } from "@googleapis/sheets";
import { prisma } from "@/lib/prisma";
import { getGoogleClients } from "@/lib/gdrive";

// "CONT DUMP" tab of the contract dump Google Sheet. Keyed by QUOTATION_NO:
// brings CONTRACT_NO -> TenderMerged.contractNo and TENDER_VRNO -> TenderMerged.tmNo.
const SHEET_ID = "1R3pTO72Q4O3QtfvKp2asL7a2BrpNyFk1ECLrDZ_e464";
const TAB = "CONT DUMP";

const CONTRACT_HEADER = "CONTRACT_NO";
const QUOTATION_HEADER = "QUOTATION_NO";
const TM_HEADER = "TENDER_VRNO";

const NULL_VALUES = new Set(["", "-", "null", "n.a", "na", "not quoted"]);

export interface ContDumpSyncStats {
  sheetRows: number;
  uniqueQuotations: number;
  multiContractQuotations: number;
  multiTmQuotations: number;
  totalTenders: number;
  /** DB rows that got at least one field filled. */
  updated: number;
  updatedContract: number;
  updatedTm: number;
  /** DB rows already holding the sheet values (no write needed). */
  skippedExisting: number;
  /** DB rows with a quotationNo absent from the sheet. */
  notFound: number;
  errors: number;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function cell(row: string[] | undefined, idx: number): string {
  const v = row && row[idx] !== undefined ? String(row[idx]).trim() : "";
  return v === "" || NULL_VALUES.has(v.toLowerCase()) ? "" : v;
}

export async function syncContractAndTmFromContDump(): Promise<ContDumpSyncStats> {
  const stats: ContDumpSyncStats = {
    sheetRows: 0,
    uniqueQuotations: 0,
    multiContractQuotations: 0,
    multiTmQuotations: 0,
    totalTenders: 0,
    updated: 0,
    updatedContract: 0,
    updatedTm: 0,
    skippedExisting: 0,
    notFound: 0,
    errors: 0,
  };

  // 1. Read the sheet.
  let rows: string[][];
  try {
    const { oauth2Client } = getGoogleClients();
    const sheets = googleSheets({ version: "v4", auth: oauth2Client });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A1:ZZ`,
    });
    rows = (res.data.values as string[][]) ?? [];
  } catch (err) {
    console.warn("[ContDumpSync] Failed to read sheet:", (err as Error).message);
    stats.errors++;
    return stats;
  }

  if (rows.length < 2) {
    console.warn("[ContDumpSync] Sheet has no data rows.");
    return stats;
  }

  // 2. Resolve columns by header name.
  const headers = rows[0].map(normalizeHeader);
  const contractIdx = headers.indexOf(normalizeHeader(CONTRACT_HEADER));
  const quotationIdx = headers.indexOf(normalizeHeader(QUOTATION_HEADER));
  const tmIdx = headers.indexOf(normalizeHeader(TM_HEADER));
  if (contractIdx === -1 || quotationIdx === -1 || tmIdx === -1) {
    console.warn(
      `[ContDumpSync] Missing header(s) in "${TAB}": contract=${contractIdx} quotation=${quotationIdx} tm=${tmIdx}. Actual: ${JSON.stringify(rows[0])}`,
    );
    stats.errors++;
    return stats;
  }

  stats.sheetRows = rows.length - 1;

  // 3. Build quotation -> Set<contract> and quotation -> Set<tm>.
  const contractSetByQuotation = new Map<string, Set<string>>();
  const tmSetByQuotation = new Map<string, Set<string>>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const q = cell(row, quotationIdx);
    if (!q) continue;

    const contract = cell(row, contractIdx);
    if (contract) {
      if (!contractSetByQuotation.has(q)) contractSetByQuotation.set(q, new Set());
      contractSetByQuotation.get(q)!.add(contract);
    }

    const tm = cell(row, tmIdx);
    if (tm) {
      if (!tmSetByQuotation.has(q)) tmSetByQuotation.set(q, new Set());
      tmSetByQuotation.get(q)!.add(tm);
    }
  }

  const contractByQuotation = new Map<string, string>();
  for (const [q, set] of contractSetByQuotation) {
    contractByQuotation.set(q, Array.from(set).join(", "));
    if (set.size > 1) stats.multiContractQuotations++;
  }
  const tmByQuotation = new Map<string, string>();
  for (const [q, set] of tmSetByQuotation) {
    tmByQuotation.set(q, Array.from(set).join(", "));
    if (set.size > 1) stats.multiTmQuotations++;
  }
  stats.uniqueQuotations = contractByQuotation.size;

  // 4. Match TenderMerged.quotationNo, fill only fields that are currently empty.
  const tenders = await prisma.tenderMerged.findMany({
    where: { quotationNo: { not: null } },
    select: { id: true, quotationNo: true, contractNo: true, tmNo: true },
  });
  stats.totalTenders = tenders.length;

  for (const tender of tenders) {
    const q = (tender.quotationNo ?? "").trim();
    if (!q) continue;

    const contractNo = contractByQuotation.get(q);
    const tmNo = tmByQuotation.get(q);
    if (contractNo === undefined && tmNo === undefined) {
      stats.notFound++;
      continue;
    }

    // Incoming non-empty values replace existing ones; null/empty sheet values are
    // already excluded from the maps and never blank a populated DB field.
    const data: { contractNo?: string; tmNo?: string } = {};
    if (contractNo !== undefined && contractNo !== (tender.contractNo ?? "").trim()) data.contractNo = contractNo;
    if (tmNo !== undefined && tmNo !== (tender.tmNo ?? "").trim()) data.tmNo = tmNo;

    if (Object.keys(data).length === 0) {
      stats.skippedExisting++;
      continue;
    }

    try {
      await prisma.tenderMerged.update({ where: { id: tender.id }, data });
      stats.updated++;
      if (data.contractNo !== undefined) stats.updatedContract++;
      if (data.tmNo !== undefined) stats.updatedTm++;
    } catch (err) {
      console.warn(`[ContDumpSync] Failed to update id=${tender.id} quotationNo="${q}":`, (err as Error).message);
      stats.errors++;
    }
  }

  console.log(
    `[ContDumpSync] matched ${stats.updated} tenders (contract: ${stats.updatedContract}, tm: ${stats.updatedTm}) from ${stats.uniqueQuotations} sheet quotations (${stats.notFound} not found, ${stats.skippedExisting} already set, ${stats.errors} errors)`,
  );
  return stats;
}
