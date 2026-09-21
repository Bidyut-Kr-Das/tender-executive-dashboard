import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";

interface UpdateAgentReportInput {
  referenceNo: string;
  agentReport: string | null;
}

async function updateAgentReport({ referenceNo, agentReport }: UpdateAgentReportInput) {
  const existing = await prisma.tenderMerged.findUnique({
    where: { referenceNo },
    select: { id: true },
  });
  if (!existing) {
    const err = new Error(`Reference not found: ${referenceNo}`);
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  await prisma.tenderMerged.update({
    where: { id: existing.id },
    data: { agentReport },
  });

  return { success: true, referenceNo, agentReport };
}

const updateAgentReportWithLog = withLog(
  updateAgentReport,
  (result) => ({
    action: "UPDATE" as const,
    tableName: "TenderMerged",
    recordId: undefined,
    referenceNo: result.referenceNo,
    details: `Agent report updated: ${result.agentReport ?? "(cleared)"}`,
  }),
);

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { referenceNo, agentReport } = body;

    if (typeof referenceNo !== "string" || !referenceNo.trim()) {
      return NextResponse.json({ error: "referenceNo is required" }, { status: 400 });
    }
    if (agentReport != null && typeof agentReport !== "string") {
      return NextResponse.json({ error: "agentReport must be a string or null" }, { status: 400 });
    }

    const result = await updateAgentReportWithLog({
      referenceNo: referenceNo.trim(),
      agentReport: agentReport ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status },
    );
  }
}