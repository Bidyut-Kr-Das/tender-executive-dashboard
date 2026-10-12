"use server";

import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { requireUserAction } from "@/lib/dal";
import { summarizeLifecycle, type LifecycleCounts } from "@/lib/tender-lifecycle";

async function fetchLifecycleCountsFn(): Promise<LifecycleCounts> {
  await requireUserAction();
  const [tenders, files] = await Promise.all([
    prisma.tenderMerged.groupBy({
      by: ["lifecycleStatus"],
      _count: { _all: true },
      _min: { lifecycleUpdatedAt: true },
    }),
    prisma.tenderFile.groupBy({ by: ["parseStatus"], _count: { _all: true } }),
  ]);
  return summarizeLifecycle(
    tenders.map((g) => ({
      status: g.lifecycleStatus,
      count: g._count._all,
      oldest: g._min.lifecycleUpdatedAt,
    })),
    files.map((g) => ({ status: g.parseStatus, count: g._count._all })),
  );
}

// A read, polled every few seconds: never logged.
export const fetchLifecycleCounts = withLog(fetchLifecycleCountsFn, () => null);
