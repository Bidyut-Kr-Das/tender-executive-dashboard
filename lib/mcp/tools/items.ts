import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const GLOSSARY = `Item names are upper-case catalog descriptions. Abbreviations:
- ARD / ARM = armoured, UNARD / UNARM = unarmoured; WIRE / STRIP = armour type
- AL / ALU = aluminium, CU = copper, CC/AL = copper-clad aluminium
- XLPE / PVC = insulation; FRLS = fire-retardant low-smoke; YY/FR = flexible PVC fire-retardant
- ABC = aerial bunched cable (LT unless the schedule says HT); HT = high tension, rated in KV (6, 11, 22, 33 KV)
- ACSR, AAAC, AAC, AACSR = bare overhead conductors, often named after animals (DOG, PANTHER, ZEBRA, MOOSE...), with a strand pattern like (6/4.72/7/1.57)
- SWG = standard wire gauge
Cable names look like "4 CORE X 50 SQ. MM. CU/ARD - WIRE (XLPE) - 11 KV".`;

const category = z.object({
  schedule: z.string(),
  count: z.number(),
  codePrefixes: z.array(z.string()),
  example: z.string(),
});

const item = z.object({
  itemcode: z.string(),
  itemName: z.string(),
  itemSchedule: z.string(),
});

const MAX_LIMIT = 200;

export function registerItemTools(server: McpServer) {
  server.registerTool(
    "list_item_categories",
    {
      title: "List item categories",
      description: `Lists every item schedule (category) in the product catalog of a cable and conductor manufacturer, with its item count, item code prefixes and one example item name.
Call this first. Then call search_items with schedule values copied exactly from this list.

${GLOSSARY}`,
      annotations: { readOnlyHint: true },
      outputSchema: z.object({ categories: z.array(category) }),
    },
    async () => {
      const rows = await prisma.items.findMany({
        select: { itemcode: true, itemName: true, itemSchedule: true },
        orderBy: { itemcode: "asc" },
      });
      const bySchedule = new Map<string, z.infer<typeof category>>();
      for (const row of rows) {
        const entry = bySchedule.get(row.itemSchedule) ?? {
          schedule: row.itemSchedule,
          count: 0,
          codePrefixes: [],
          example: row.itemName,
        };
        entry.count++;
        const prefix = row.itemcode.slice(0, 4);
        if (!entry.codePrefixes.includes(prefix)) entry.codePrefixes.push(prefix);
        bySchedule.set(row.itemSchedule, entry);
      }
      const categories = [...bySchedule.values()].sort((a, b) => b.count - a.count);
      return {
        content: [{ type: "text", text: JSON.stringify({ categories }) }],
        structuredContent: { categories },
      };
    },
  );

  server.registerTool(
    "search_items",
    {
      title: "Search items",
      description: `Searches the product catalog and returns item code, item name and item schedule.
Call list_item_categories first to learn the schedules and naming. At least one filter is required.
- schedules: exact schedule names from list_item_categories (any of them matches).
- keywords: every keyword must appear in the item name (case-insensitive). Use short tokens such as "XLPE", "CU", "4 CORE", "95 SQ", "11 KV", "DOG", not whole names: spacing in names varies ("SQ. MM.", "SQ.MM", "SQ MM").
- itemcodePrefix: start of the item code, for example "FA13".
Returns total matches and up to limit items. When total is larger than returned, narrow the filters.

${GLOSSARY}`,
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        schedules: z.array(z.string()).optional().describe("Exact schedule names from list_item_categories"),
        keywords: z.array(z.string()).optional().describe("Tokens that must all appear in the item name"),
        itemcodePrefix: z.string().optional().describe("Start of the item code, e.g. FA13"),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Max items returned, default 50, max ${MAX_LIMIT}`),
      }),
      outputSchema: z.object({ total: z.number(), returned: z.number(), items: z.array(item) }),
    },
    async ({ schedules, keywords, itemcodePrefix, limit }) => {
      const words = (keywords ?? []).map((k) => k.trim()).filter(Boolean);
      const prefix = itemcodePrefix?.trim();
      if (!schedules?.length && !words.length && !prefix) {
        return {
          isError: true,
          content: [{ type: "text", text: "Give at least one of schedules, keywords or itemcodePrefix. Call list_item_categories to see what exists." }],
        };
      }

      const where: Prisma.ItemsWhereInput = {
        ...(schedules?.length && { itemSchedule: { in: schedules } }),
        ...(prefix && { itemcode: { startsWith: prefix, mode: "insensitive" } }),
        AND: words.map((w) => ({ itemName: { contains: w, mode: "insensitive" } })),
      };
      const [total, items] = await Promise.all([
        prisma.items.count({ where }),
        prisma.items.findMany({
          where,
          select: { itemcode: true, itemName: true, itemSchedule: true },
          orderBy: { itemcode: "asc" },
          take: limit ?? 50,
        }),
      ]);
      const result = { total, returned: items.length, items };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
}
