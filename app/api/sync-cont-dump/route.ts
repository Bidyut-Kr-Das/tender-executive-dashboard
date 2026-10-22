import { NextRequest, NextResponse } from "next/server";
import { syncContractAndTmFromContDump } from "@/services/contDumpSyncService";
import { requireApiKey } from "@/lib/dal";
import { withLog } from "@/lib/activity-logger";

export const runtime = "nodejs";

async function runSyncContDump() {
  return syncContractAndTmFromContDump();
}

const syncContDumpWithLog = withLog(runSyncContDump, (stats) => ({
  action: "UPDATE" as const,
  tableName: "TenderMerged",
  details: `Synced from CONT DUMP: ${stats.updated} tenders updated (contract: ${stats.updatedContract}, tm: ${stats.updatedTm}) from ${stats.uniqueQuotations} quotations (${stats.notFound} not found, ${stats.skippedExisting} unchanged, ${stats.errors} errors)`,
}));

export async function POST(req: NextRequest) {
  const forbidden = await requireApiKey(req);
  if (forbidden) return forbidden;

  try {
    const stats = await syncContDumpWithLog();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
