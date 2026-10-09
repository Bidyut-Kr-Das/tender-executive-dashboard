"use server";

import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { requireUserAction } from "@/lib/dal";

export const getPerformanceCertificates = withLog(
  async () =>
    prisma.performanceCertificate.findMany({ orderBy: { createdAt: "desc" } }),
  () => null,
);

export const getSupplyPartyNames = withLog(async () => {
  const rows = await prisma.supplyHistory.findMany({
    distinct: ["partyName"],
    select: { partyName: true },
    where: { partyName: { not: null } },
    orderBy: { partyName: "asc" },
  });
  return rows
    .map((r) => r.partyName?.trim())
    .filter((v): v is string => Boolean(v)) as string[];
}, () => null);

export const updatePerformanceCertificatePartyName = withLog(
  async (id: string, partyName: string | null) => {
    await requireUserAction();
    return prisma.performanceCertificate.update({
      where: { id },
      data: { partyName },
    });
  },
  (result, id, partyName) => ({
    action: "UPDATE" as const,
    tableName: "PerformanceCertificate",
    recordId: String(id),
    details: `partyName -> ${partyName ?? "null"}`,
  }),
);

export type PerformanceCertificateField =
  | "utilityOrClient"
  | "useNotUse"
  | "itemSchedule";

export const updatePerformanceCertificateField = withLog(
  async (
    id: string,
    field: PerformanceCertificateField,
    value: string | null,
  ) => {
    await requireUserAction();
    return prisma.performanceCertificate.update({
      where: { id },
      data: { [field]: value },
    });
  },
  (result, id, field, value) => ({
    action: "UPDATE" as const,
    tableName: "PerformanceCertificate",
    recordId: String(id),
    details: `${field} -> ${value ?? "null"}`,
  }),
);
