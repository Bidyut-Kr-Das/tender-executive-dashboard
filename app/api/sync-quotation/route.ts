import { NextRequest, NextResponse } from "next/server";
import { syncQuotationByDocketFromSmartsheet } from "@/services/quotationByDocketSyncService";
import { requireApiKey } from "@/lib/dal";
import { withLog } from "@/lib/activity-logger";

const syncQuotationWithLog = withLog(
  syncQuotationByDocketFromSmartsheet,
  (stats, options) =>
    options?.dryRun
      ? null
      : {
          action: "UPDATE" as const,
          tableName: "TenderMerged",
          details: `Synced quotationNo from Smartsheet: ${stats.updated} updated (${stats.notFound} not found, ${stats.skippedExisting} already set, ${stats.errors} errors, ${stats.total} scanned)`,
        },
);

export async function POST(req: NextRequest) {
  const forbidden = await requireApiKey(req);
  if (forbidden) return forbidden;

  try {
    const stats = await syncQuotationWithLog({
      dryRun: req.nextUrl.searchParams.get("dryRun") === "1",
    });
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
