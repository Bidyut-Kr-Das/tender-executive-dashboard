import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { publishTenderTask } from "@/lib/queue/publisher";

interface UpdateAiRelevanceInput {
  referenceNo: string;
  valid: boolean;
  reason: string;
}

async function updateAiRelevance({ referenceNo, valid, reason }: UpdateAiRelevanceInput) {
  const existing = await prisma.tenderMerged.findUnique({
    where: { referenceNo },
    select: { id: true, tenderType: true },
  });
  if (!existing) {
    const err = new Error(`Reference not found: ${referenceNo}`);
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  await prisma.tenderMerged.update({
    where: { id: existing.id },
    data: { aiRelevanceValid: valid, aiRelevanceReason: reason },
  });

  // Only publish download job for valid tenders; publish failure must not
  // fail the webhook — the AI result is already saved.
  let downloadQueued = false;
  if (valid) {
    if (existing.tenderType === "GEM") {
      downloadQueued = await publishTenderTask({
        type: "GEM_DOWNLOAD",
        tenderId: existing.id,
        gemId: referenceNo,
        referenceNo,
        timestamp: Date.now(),
      });
    } else {
      downloadQueued = await publishTenderTask({
        type: "NON_GEM_DOWNLOAD",
        tenderId: existing.id,
        referenceNo,
        timestamp: Date.now(),
      });
    }
    if (!downloadQueued) {
      console.warn(
        `[ai-relevance] Download job not queued for ${referenceNo} (RabbitMQ unavailable?)`,
      );
    }
  }

  return { success: true, referenceNo, valid, reason, downloadQueued };
}

const updateAiRelevanceWithLog = withLog(
  updateAiRelevance,
  (result) => ({
    action: "UPDATE" as const,
    tableName: "TenderMerged",
    recordId: undefined,
    referenceNo: result.referenceNo,
    details: `AI relevance set valid=${result.valid} queued=${result.downloadQueued}: ${result.reason}`,
    // Public webhook — no auth session, so label the actor explicitly.
    userId: null,
    userName: "Relevance Agent",
    userEmail: "ai-agent@laserpower.in",
  }),
);

const COMPANIES = ["laser", "gmd"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const referenceNo =
      typeof body.referenceNo === "string" ? body.referenceNo.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim().toLowerCase() : "";
    const valid = body.valid;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!referenceNo) {
      return NextResponse.json({ error: "referenceNo is required" }, { status: 400 });
    }
    if (!COMPANIES.includes(company)) {
      return NextResponse.json(
        { error: `company must be one of: ${COMPANIES.join(", ")}` },
        { status: 400 },
      );
    }
    if (typeof valid !== "boolean") {
      return NextResponse.json({ error: "valid must be a boolean" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const result = await updateAiRelevanceWithLog({ referenceNo, valid, reason });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status },
    );
  }
}