"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import type { ColumnFilterState } from "@/lib/types";
import type { SupplyHistoryRecord } from "@/types/supplyHistory";
import { BLANK } from "@/components/v2/data-table/types";
import { DatabaseSupplyService } from "@/services/databaseSupplyService";
import { fetchSupplyHistoryFromGoogleSheet } from "@/services/supplySheetService";

export type SupplyFilters = Record<string, ColumnFilterState>;
export type SupplySort = { column: string; direction: "asc" | "desc" } | null;
export type SupplyRow = SupplyHistoryRecord & { key: string };

export interface SupplyPageResult {
  rows: SupplyRow[];
  total: number;
  totals: { amount: number; quantity: number; withBill: number };
  /** Recipient emails per party ref no on this page, across every row sharing it. */
  emailsByRef: Record<string, string[]>;
}

const MAX_PAGE_SIZE = 500;
const FACET_LIMIT = 500;

const col = (name: string) => Prisma.raw(`s."${name}"`);

const TEXT_COLUMNS = [
  "fy", "saleBillNumber", "partyName", "itemCode", "itemSchedule", "itemName", "lrNo",
  "partyRefNo", "contractVrNo", "quotationNo", "docketNo", "utility", "email", "contactNo",
];

/** A sheet date is "07-Jun-24" or an ISO instant at IST midnight; both read as the IST day. */
const sheetDay = (name: string) => Prisma.sql`(CASE
  WHEN ${col(name)} ~ '^[0-9]{4}-' THEN (${col(name)}::timestamptz AT TIME ZONE 'Asia/Kolkata')::date
  WHEN ${col(name)} ~ '^[0-9]{1,2}-[A-Za-z]{3}-[0-9]{2}$' THEN to_date(${col(name)}, 'DD-Mon-YY')
END)`;

// Stored as UTC without a zone.
const sentDay = Prisma.sql`((s."certificateSentDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date`;

/**
 * Per column: `value` is what sorts and range-filters, `text` is what the cell
 * shows, for "contains" and select filters.
 */
const COLUMNS: Record<string, { value: Prisma.Sql; text: Prisma.Sql }> = {
  ...Object.fromEntries(
    TEXT_COLUMNS.map((id) => [
      id,
      { value: Prisma.sql`lower(NULLIF(trim(${col(id)}), ''))`, text: Prisma.sql`coalesce(trim(${col(id)}), '')` },
    ]),
  ),
  ...Object.fromEntries(
    ["saleBillDate", "partyRefDate"].map((id) => [
      id,
      { value: sheetDay(id), text: Prisma.sql`coalesce(to_char(${sheetDay(id)}, 'DD Mon YY'), '')` },
    ]),
  ),
  // ponytail: "contains" on a number matches its plain digits, not the "1,234.00" the cell shows.
  ...Object.fromEntries(
    ["rate", "invoiceQty", "invoiceAmt"].map((id) => [
      id,
      { value: col(id), text: Prisma.sql`coalesce(${col(id)}::text, '')` },
    ]),
  ),
  hasDocuments: {
    value: Prisma.sql`(d.b IS NOT NULL)`,
    text: Prisma.sql`(CASE WHEN d.b IS NOT NULL THEN 'Yes' ELSE 'No' END)`,
  },
  certificateSentDate: {
    value: sentDay,
    text: Prisma.sql`coalesce(to_char(${sentDay}, 'DD Mon YY'), 'Not Sent')`,
  },
};

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");

/** Bills with a scanned document, matched the way the indexer stores them. */
const FROM = Prisma.sql`
  "SupplyHistory" s
  LEFT JOIN (SELECT DISTINCT upper(trim("saleBillNumber")) AS b FROM supply_docs) d
    ON d.b = upper(trim(s."saleBillNumber"))`;

function whereSql(filters: SupplyFilters, skipColumn?: string): Prisma.Sql {
  const parts = [Prisma.sql`s.fy ~ '^[0-9]{2}-[0-9]{2}$'`];
  for (const [id, f] of Object.entries(filters ?? {})) {
    const c = COLUMNS[id];
    if (!c || !f || id === skipColumn) continue;
    const text = f.text?.trim();
    if (text) parts.push(Prisma.sql`${c.text} ILIKE ${`%${escapeLike(text)}%`}`);
    if (f.select?.length) {
      const values = f.select.filter((v) => v !== BLANK.value);
      const any: Prisma.Sql[] = [];
      if (values.length) any.push(Prisma.sql`${c.text} IN (${Prisma.join(values)})`);
      if (values.length < f.select.length) any.push(Prisma.sql`${c.text} = ''`);
      parts.push(Prisma.sql`(${Prisma.join(any, " OR ")})`);
    }
    const { startDate, endDate } = f.dateRange ?? {};
    if (isDay(startDate)) parts.push(Prisma.sql`${c.value} >= ${startDate}::date`);
    if (isDay(endDate)) parts.push(Prisma.sql`${c.value} <= ${endDate}::date`);
    if (f.boolean != null && id === "hasDocuments") parts.push(Prisma.sql`${c.value} = ${f.boolean}`);
    const min = Number(f.numberRange?.min);
    const max = Number(f.numberRange?.max);
    if (f.numberRange?.min && Number.isFinite(min)) parts.push(Prisma.sql`${c.value} >= ${min}`);
    if (f.numberRange?.max && Number.isFinite(max)) parts.push(Prisma.sql`${c.value} <= ${max}`);
  }
  return Prisma.join(parts, " AND ");
}

/** Empty values go last in both directions; id keeps pages stable. */
function orderSql(sort: SupplySort): Prisma.Sql {
  const c = sort && COLUMNS[sort.column];
  if (!c) return Prisma.sql`s."createdAt" DESC, s.id`;
  const dir = Prisma.raw(sort.direction === "asc" ? "ASC" : "DESC");
  return Prisma.sql`${c.value} ${dir} NULLS LAST, s.id`;
}

type DbRow = Omit<SupplyHistoryRecord, "certificateSentDate"> & {
  id: string;
  certificateSentDate: Date | null;
};

async function selectRows(filters: SupplyFilters, sort: SupplySort, limit?: Prisma.Sql) {
  const rows = await prisma.$queryRaw<DbRow[]>`
    SELECT s."id", s."fy", s."saleBillNumber", s."saleBillDate", s."partyName", s."itemCode",
           s."itemSchedule", s."itemName", s."lrNo", s."truckNo", s."partyRefNo", s."partyRefDate",
           s."contractVrNo", s."quotationNo", s."docketNo", s."utility", s."rate", s."invoiceQty",
           s."invoiceAmt", s."attachmentUrl", s."documentUrls", s."email", s."contactNo",
           s."certificateUrl", s."certificateFileName", s."certificateSentDate",
           (d.b IS NOT NULL) AS "hasDocuments"
    FROM ${FROM}
    WHERE ${whereSql(filters)}
    ORDER BY ${orderSql(sort)}
    ${limit ?? Prisma.empty}
  `;
  return rows.map(({ id, certificateSentDate, ...r }): SupplyRow => ({
    ...r,
    key: id,
    certificateSentDate: certificateSentDate ? certificateSentDate.toISOString() : null,
  }));
}

export const fetchSupplyPage = withLog(
  async (query: {
    filters: SupplyFilters;
    sort: SupplySort;
    page: number;
    pageSize: number;
  }): Promise<SupplyPageResult> => {
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(query.pageSize)) || 50));
    const page = Math.max(1, Math.trunc(Number(query.page)) || 1);

    const [rows, [sums]] = await Promise.all([
      selectRows(
        query.filters,
        query.sort,
        Prisma.sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      ),
      prisma.$queryRaw<{ total: number; amount: number; quantity: number; withBill: number }[]>`
        SELECT count(*)::int AS total,
               coalesce(sum(s."invoiceAmt"), 0)::float AS amount,
               coalesce(sum(s."invoiceQty"), 0)::float AS quantity,
               (count(*) FILTER (WHERE coalesce(s."saleBillNumber", '') <> ''))::int AS "withBill"
        FROM ${FROM}
        WHERE ${whereSql(query.filters)}
      `,
    ]);

    const refs = [...new Set(rows.map((r) => r.partyRefNo).filter((r): r is string => !!r))];
    const emailRows = refs.length
      ? await prisma.supplyHistory.findMany({
          where: { partyRefNo: { in: refs }, email: { not: null }, NOT: { email: "" } },
          select: { partyRefNo: true, email: true },
        })
      : [];
    const emailsByRef: Record<string, string[]> = {};
    for (const r of emailRows) (emailsByRef[r.partyRefNo!] ??= []).push(r.email!);

    return {
      rows,
      total: sums.total,
      totals: { amount: sums.amount, quantity: sums.quantity, withBill: sums.withBill },
      emailsByRef,
    };
  },
  () => null,
);

/** Every matching row, for exports and the certificate of one party ref. */
export const fetchSupplyRows = withLog(
  async (filters: SupplyFilters, sort: SupplySort) => selectRows(filters, sort),
  () => null,
);

/** A column's distinct values under every other active filter, like the tenders page. */
export const fetchSupplyFacet = withLog(
  async (filters: SupplyFilters, column: string) => {
    if (!TEXT_COLUMNS.includes(column)) return { options: [] as string[], overLimit: false };
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT DISTINCT ${COLUMNS[column].text} AS value
      FROM ${FROM}
      WHERE ${whereSql(filters, column)} AND ${COLUMNS[column].text} <> ''
      ORDER BY 1
      LIMIT ${FACET_LIMIT + 1}
    `;
    return {
      options: rows.slice(0, FACET_LIMIT).map((r) => r.value),
      overLimit: rows.length > FACET_LIMIT,
    };
  },
  () => null,
);

/** Pulls the Google Sheet into the database. */
export const syncSupplySheet = withLog(
  async () => {
    const records = await fetchSupplyHistoryFromGoogleSheet();
    await DatabaseSupplyService.upsertSupplyHistory(records);
    return records.length;
  },
  () => null,
);
