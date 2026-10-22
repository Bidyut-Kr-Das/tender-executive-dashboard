import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const row = z.object({
  saleBillNumber: z.string().nullable(),
  saleBillDate: z.string().nullable(),
  fy: z.string().nullable(),
  partyName: z.string().nullable(),
  partyRefNo: z.string().nullable(),
  partyRefDate: z.string().nullable(),
  utility: z.string().nullable(),
  itemCode: z.string().nullable(),
  itemName: z.string().nullable(),
  itemSchedule: z.string().nullable(),
  invoiceQty: z.number().nullable(),
  rate: z.number().nullable(),
  invoiceAmt: z.number().nullable(),
});

const MAX_LIMIT = 200;

export function registerSupplyTools(server: McpServer) {
  server.registerTool(
    "search_supply_history",
    {
      title: "Search supply history",
      description: `Searches supply history (sale bills) of a cable and conductor manufacturer. Each row is one item on one sale bill, with party, party reference (PO / LOA no), utility, item code, item name, item schedule, quantity and amount.
At least one filter is required.
- partyRefNo: the party / purchase-order reference number, matched exactly (case-insensitive, surrounding spaces ignored).
- partyName: text that must appear in the party name (case-insensitive).
Returns total matches and up to limit rows. When total is larger than returned, narrow the filters.`,
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        partyRefNo: z.string().optional().describe("Exact party / PO reference number"),
        partyName: z.string().optional().describe("Text contained in the party name"),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Max rows returned, default 50, max ${MAX_LIMIT}`),
      }),
      outputSchema: z.object({ total: z.number(), returned: z.number(), rows: z.array(row) }),
    },
    async ({ partyRefNo, partyName, limit }) => {
      const ref = partyRefNo?.trim();
      const name = partyName?.trim();
      if (!ref && !name) {
        return {
          isError: true,
          content: [{ type: "text", text: "Give at least one of partyRefNo or partyName." }],
        };
      }

      const where: Prisma.SupplyHistoryWhereInput = {
        ...(ref && { partyRefNo: { equals: ref, mode: "insensitive" } }),
        ...(name && { partyName: { contains: name, mode: "insensitive" } }),
      };
      const [total, rows] = await Promise.all([
        prisma.supplyHistory.count({ where }),
        prisma.supplyHistory.findMany({
          where,
          select: {
            saleBillNumber: true,
            saleBillDate: true,
            fy: true,
            partyName: true,
            partyRefNo: true,
            partyRefDate: true,
            utility: true,
            itemCode: true,
            itemName: true,
            itemSchedule: true,
            invoiceQty: true,
            rate: true,
            invoiceAmt: true,
          },
          orderBy: [{ saleBillNumber: "asc" }, { itemCode: "asc" }],
          take: limit ?? 50,
        }),
      ]);
      const result = { total, returned: rows.length, rows };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
