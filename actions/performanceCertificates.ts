"use server";

import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";

export const getPerformanceCertificates = withLog(
  async () =>
    prisma.performanceCertificate.findMany({ orderBy: { createdAt: "desc" } }),
  () => null,
);
