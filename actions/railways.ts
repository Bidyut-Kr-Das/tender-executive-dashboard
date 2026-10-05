"use server";

import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { requireUserAction } from "@/lib/dal";

export async function getRailways() {
  return prisma.railways.findMany({ orderBy: { dueDate: "desc" } });
}

export const updateRailwaysErpCode = withLog(
  async (id: number, erpCode: string | null) => {
    await requireUserAction();
    return prisma.railways.update({ where: { id }, data: { erpCode } });
  },
  (result, id, erpCode) => ({
    action: "UPDATE" as const,
    tableName: "Railways",
    recordId: String(id),
    details: `erpCode -> ${erpCode ?? "null"}`,
  }),
);