import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { calcDiffString } from "@/lib/diffCalculator";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// The differences are computed here from the values, never sent by a client.
const EDITABLE = [
  "bomType",
  "bomCode",
  "ourRank",
  "ourValue",
  "nameOfRank1",
  "valueOfRank1",
  "nameOfRank2",
  "valueOfRank2",
] as const;
type EditableField = (typeof EDITABLE)[number];
type Patch = Partial<Record<EditableField, string | null>>;

async function updateCostingDetails(params: { costingId: number; patch: Patch }) {
  const { costingId, patch } = params;
  if (!costingId || Number.isNaN(costingId)) throw Object.assign(new Error("Invalid costing id"), { status: 400 });

  const existing = await prisma.costingSheetDetails.findUnique({
    where: { id: costingId },
    include: { TenderMerged: { select: { referenceNo: true } } },
  });
  if (!existing) throw Object.assign(new Error("CostingSheetDetails not found"), { status: 404 });

  const { TenderMerged, ...before } = existing;
  const data: Record<string, string | null> = { ...patch };
  const next = { ...before, ...patch };
  // Same rule as the tender's Diff L1/L2 in updateTenderMergedStringField.
  if ("ourValue" in patch || "valueOfRank1" in patch) {
    data.differenceBetweenRank1 = calcDiffString(next.ourValue, next.valueOfRank1);
  }
  if ("ourValue" in patch || "valueOfRank2" in patch) {
    data.differenceBetweenRank2 = calcDiffString(next.ourValue, next.valueOfRank2);
  }

  const updated = await prisma.costingSheetDetails.update({ where: { id: costingId }, data });
  return {
    updated,
    existing: before,
    referenceNo: TenderMerged?.referenceNo ?? undefined,
    changed: Object.keys(data) as (keyof typeof before)[],
  };
}

const updateCostingDetailsWithLog = withLog(updateCostingDetails, (result, params) => ({
  action: "UPDATE" as const,
  tableName: "CostingSheetDetails",
  recordId: String(params.costingId),
  referenceNo: result.referenceNo,
  details: `Updated CostingSheetDetails ${params.costingId}: ${result.changed
    .map((f) => `${f} "${result.existing[f] ?? ""}" -> "${result.updated[f] ?? ""}"`)
    .join(", ")}`,
}));

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const costingId = Number(id);
    const body = await req.json().catch(() => ({}));

    // Partial update: only the fields sent are written; empty or null clears one.
    const patch: Patch = {};
    for (const field of EDITABLE) {
      if (body[field] === undefined) continue;
      const value = body[field] == null ? "" : String(body[field]).trim();
      patch[field] = value === "" ? null : value;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: `One of ${EDITABLE.join(", ")} is required` }, { status: 400 });
    }

    const result = await updateCostingDetailsWithLog({ costingId, patch });
    return NextResponse.json({ success: true, data: result.updated });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ success: false, error: err.message || "Failed to update" }, { status });
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const costingId = Number(id);
    const row = await prisma.costingSheetDetails.findUnique({ where: { id: costingId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
