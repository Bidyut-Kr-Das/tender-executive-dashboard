import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { publishFeedbackTask } from "@/lib/queue/publisher";

export async function GET() {
  try {
    const feedback = await prisma.aiFeedback.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(feedback);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 },
    );
  }
}

interface SaveFeedbackInput {
  tenderId: number;
  tenderType: string;
  briefText: string;
  originalAi: string;
  correctedAi: string;
  feedbackReason: string;
}

async function publishFeedback(input: SaveFeedbackInput) {
  const tender = await prisma.tenderMerged.findUnique({
    where: { id: input.tenderId },
    select: { referenceNo: true },
  });
  if (!tender) {
    const err = new Error(`Tender not found: ${input.tenderId}`);
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  // Feedback is not stored. It is sent to the feedback agent on the same
  // relevance queue. Publish failure must not fail the request.
  let queued = false;
  try {
    queued = await publishFeedbackTask({
      payload_type: "feedback",
      reference_no: tender.referenceNo,
      company: "laser",
      tender_id: input.tenderId,
      tender_type: input.tenderType,
      brief_text: input.briefText,
      original_ai: input.originalAi,
      corrected_ai: input.correctedAi,
      feedback_reason: input.feedbackReason,
    });
    if (!queued) {
      console.warn(
        `[ai-feedback] Feedback job not queued for ${tender.referenceNo} (RabbitMQ unavailable?)`,
      );
    }
  } catch (err) {
    console.warn(
      `[ai-feedback] Feedback publish failed for ${tender.referenceNo}:`,
      err,
    );
  }

  return { referenceNo: tender.referenceNo, queued };
}

const publishFeedbackWithLog = withLog(publishFeedback, (result) => ({
  action: "CREATE" as const,
  tableName: "agent:relevance",
  recordId: undefined,
  referenceNo: result.referenceNo,
  details: `Published feedback job (sent=${result.queued})`,
}));

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenderId, tenderType, briefText, originalAi, correctedAi, feedbackReason } = body;

    if (!tenderId || !tenderType || !briefText || !originalAi || !correctedAi || !feedbackReason) {
      console.log({
        tenderId,
        tenderType,
        briefText,
        originalAi,
        correctedAi,
        feedbackReason
      })
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await publishFeedbackWithLog({
      tenderId: Number(tenderId),
      tenderType: String(tenderType),
      briefText: String(briefText),
      originalAi: String(originalAi),
      correctedAi: String(correctedAi),
      feedbackReason: String(feedbackReason),
    });

    return NextResponse.json(result);
  } catch(error) {
    console.error(error)
    const status = (error as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save feedback" },
      { status },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenderId = searchParams.get("tenderId");
    const tenderType = searchParams.get("tenderType");

    if (!tenderId || !tenderType) {
      return NextResponse.json(
        { error: "Missing tenderId or tenderType" },
        { status: 400 },
      );
    }

    await prisma.aiFeedback.delete({
      where: {
        tenderId_tenderType: {
          tenderId: Number(tenderId),
          tenderType: String(tenderType),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete feedback" },
      { status: 500 },
    );
  }
}
