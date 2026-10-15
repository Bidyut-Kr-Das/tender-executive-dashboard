"use server";

import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { requireUserAction } from "@/lib/dal";
import { createPresignedUpload } from "@/lib/s3";

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

export const getUtilityPartyNames = withLog(async () => {
  const rows = await prisma.tenderMerged.findMany({
    distinct: ["erpPartyName"],
    select: { erpPartyName: true },
    where: { erpPartyName: { not: null } },
    orderBy: { erpPartyName: "asc" },
  });
  return rows
    .map((r) => r.erpPartyName?.trim())
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
  | "itemSchedule"
  | "utilityNames"
  | "duplicateOfId";

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

/** Presigned PUT so the file goes straight to S3, not through the action. */
export const createPerformanceCertificateUpload = withLog(
  async (fileName: string, contentType: string) => {
    await requireUserAction();
    return createPresignedUpload({
      fileName,
      contentType,
      folder: "performance-certificates",
    });
  },
  () => null,
);

export const createPerformanceCertificate = withLog(
  async (certificateName: string, certificateUrl: string) => {
    await requireUserAction();
    return prisma.performanceCertificate.create({
      data: { certificateName, certificateUrl },
    });
  },
  (result) => ({
    action: "CREATE" as const,
    tableName: "PerformanceCertificate",
    recordId: result.id,
    details: result.certificateName ?? undefined,
  }),
);
