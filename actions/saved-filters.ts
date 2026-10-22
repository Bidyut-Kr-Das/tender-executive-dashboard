"use server";

import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { requireUserAction } from "@/lib/dal";

// Global filters are offered to every user, so only developers set them.
const isDeveloper = (role: string | undefined) => role === "developer";

export interface SavedFilterRow {
  id: string;
  name: string;
  formula: string;
  global: boolean;
}

const toRow = (f: { id: string; name: string; formula: string; userId: string | null }): SavedFilterRow => ({
  id: f.id,
  name: f.name,
  formula: f.formula,
  global: f.userId === null,
});

/** The page's global filters, then the caller's own. */
export const listSavedFilters = withLog(
  async (page: string): Promise<SavedFilterRow[]> => {
    const user = await requireUserAction();
    const rows = await prisma.savedFilter.findMany({
      where: { page, OR: [{ userId: null }, { userId: user.id }] },
      orderBy: { name: "asc" },
    });
    return rows.map(toRow).sort((a, b) => Number(b.global) - Number(a.global));
  },
  () => null,
);

export const createSavedFilter = withLog(
  async (input: { page: string; name: string; formula: string; global: boolean }): Promise<SavedFilterRow> => {
    const user = await requireUserAction();
    const name = input.name.trim();
    const formula = input.formula.trim();
    if (!name) throw new Error("Give the filter a name");
    if (!formula) throw new Error("There are no column filters to save");
    if (input.global && !isDeveloper(user.role)) throw new Error("Only developers can save global filters");
    const row = await prisma.savedFilter.create({
      data: { page: input.page, name, formula, userId: input.global ? null : user.id },
    });
    return toRow(row);
  },
  (row, input) => ({
    action: "CREATE" as const,
    tableName: "SavedFilter",
    recordId: row.id,
    details: `${row.global ? "global" : "personal"} filter "${row.name}" on ${input.page}`,
  }),
);

export const deleteSavedFilter = withLog(
  async (id: string): Promise<SavedFilterRow> => {
    const user = await requireUserAction();
    const row = await prisma.savedFilter.findUnique({ where: { id } });
    if (!row) throw new Error("This filter no longer exists");
    const allowed = row.userId === null ? isDeveloper(user.role) : row.userId === user.id;
    if (!allowed) throw new Error("You cannot delete this filter");
    await prisma.savedFilter.delete({ where: { id } });
    return toRow(row);
  },
  (row) => ({
    action: "DELETE" as const,
    tableName: "SavedFilter",
    recordId: row.id,
    details: `${row.global ? "global" : "personal"} filter "${row.name}"`,
  }),
);
