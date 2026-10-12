"use server";

import { openai } from "@ai-sdk/openai";
import { generateText, APICallError, Output } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAiFeedbackContext } from "@/lib/ai-feedback";
import { logActivity, withLog } from "@/lib/activity-logger";
import {
  INGESTION_FILE_SELECT,
  publishAgentIntelligenceTask,
  publishAiRelevanceTask,
  publishIngestionTask,
  publishTenderTask,
} from "@/lib/queue/publisher";
import { requireUserAction } from "@/lib/dal";
import {
  LIFECYCLE_SLOW_MS,
  TENDER_LIFECYCLE_STATUS,
  type LifecycleStageCount,
} from "@/lib/tender-lifecycle";
import { setLifecycleStatus, setRelevanceQueued } from "@/lib/tender-lifecycle-store";

const model = openai("gpt-5-mini");

export async function analyzeContent(prompt: string) {
  const { text } = await generateText({
    model,
    prompt,
  });
  return text;
}

export async function analyzeContentWithSystem(system: string, prompt: string) {
  const { text } = await generateText({
    model,
    system,
    prompt,
  });
  return text;
}

type TenderAnalysisResult =
  | { success: true; data: { valid: boolean; reason: string } }
  | { success: false; error: "rate_limit" | "unknown" };

const BASE_SYSTEM_PROMPT = `You are a Tender Evaluation Expert.

Determine whether the following tender brief is specifically for the SUPPLY of any of the following products.

Eligible Products (ONLY these)

Power Cables

LT Power Cables (Armoured or Unarmoured)
MV Power Cables (Medium Voltage)
Control Cables
Signalling Cables
Aerial Bunched (AB) Cables
PVC Power Cables
XLPE Power Cables

Conductors

ACSR Conductors
AAC Conductors
AAAC Conductors
AL-59 Conductors
AL-7 Conductors
ASTER Conductors
HTLS (AECC/TS) Conductors
Medium Voltage Covered Conductors (MVCC)
Strict Inclusion Rules
The tender must explicitly involve the supply, procurement, purchase, or delivery of one or more of the above products.
If the tender is only for installation, erection, laying, stringing, testing, commissioning, maintenance, repair, replacement, O&M, turnkey/EPC works, consultancy, or services, answer NO, unless the tender explicitly includes the supply of one or more eligible products.
If the products supplied are not from the above list, answer NO.
Explicit Exclusions

Always answer NO if the tender is for any of the following:

Flexible Cables
Optical Fibre Cables (OFC), Fiber Optic Cables, ADSS, OPGW, FTTH or any telecom/communication fibre cables
Elastomeric Cables or Rubber Cables
Bare Copper Conductors
Copper Wires
House Wiring Cables
Instrumentation Cables
Welding Cables
Solar Cables
Coaxial Cables
Ethernet/LAN/Data Cables
Any cable or conductor not explicitly listed under the Eligible Products section
Output Format

Respond with a single JSON object containing exactly these two fields:
- "valid": a boolean. true if the tender is specifically for the supply of eligible cables/conductors, false otherwise.
- "reason": one concise sentence (plain text) explaining whether the tender is specifically for the supply of the eligible cables/conductors.

Do NOT use "ANSWER:", "REASON:", or any other labels/prefixes inside the "reason" value.
Important: Set "valid" to true only when the tender clearly involves the supply/procurement of one or more eligible products listed above. In every other case, set "valid" to false.`;

export async function analyzeTenderValidity(
  tenderBrief: string,
): Promise<TenderAnalysisResult> {
  try {
    const feedbackContext = await getAiFeedbackContext();
    const system = BASE_SYSTEM_PROMPT + feedbackContext;

    const { output } = await generateText({
      model,
      system,
      output: Output.object({
        schema: z.object({
          valid: z
            .boolean()
            .describe(
              "true if the tender is specifically for the supply of eligible cables/conductors, false otherwise",
            ),
          reason: z
            .string()
            .describe(
              "One concise plain-text sentence explaining the decision. No ANSWER:/REASON: labels or prefixes.",
            ),
        }),
        name: "tenderValidity",
        description:
          "Whether the tender is specifically for the supply of eligible power/control cables or conductors",
      }),
      prompt: `Analyze this tender brief:\n\n${tenderBrief}`,
    });

    const reason = output.reason
      .replace(/^ANSWER:\s*(YES|NO)\s*/i, "")
      .replace(/^REASON:\s*/i, "")
      .trim();
    return { success: true, data: { valid: output.valid, reason } };
  } catch (error) {
    console.error(error);
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      return { success: false, error: "rate_limit" };
    }
    return { success: false, error: "unknown" };
  }
}

// "Power Distribution" -> "power_distribution", "Cables & Conductors" -> "cables_conductors"
function toSnakeCase(label: string | null | undefined): string | null {
  if (!label) return null;
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Amounts are stored as free text (e.g. "6,50,00,000"); strip separators before parsing.
function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

async function publishAiAnalysisJobFn(params: {
  referenceNo: string;
  tenderBrief: string;
  itemCategory: string;
}): Promise<boolean> {
  await requireUserAction();
  const tender = await prisma.tenderMerged.findUnique({
    where: { referenceNo: params.referenceNo },
    select: { subCategory: true, value: true, estimatedBidValue: true },
  });
  const sent = await publishRelevance({ ...tender, ...params });
  await setRelevanceQueued(params.referenceNo, sent);
  return sent;
}

function publishRelevance(tender: {
  referenceNo: string;
  tenderBrief?: string | null;
  itemCategory?: string | null;
  subCategory?: string | null;
  value?: string | null;
  estimatedBidValue?: string | null;
}) {
  return publishAiRelevanceTask({
    payloadType: "analysis",
    referenceNo: tender.referenceNo,
    company: "laser",
    tenderbrief: tender.tenderBrief ?? "",
    itemcategory: tender.itemCategory ?? "",
    category: toSnakeCase(tender.subCategory),
    tenderAmount: parseAmount(tender.value ?? tender.estimatedBidValue),
  });
}

type RequeueStage = LifecycleStageCount["stage"];
const REQUEUE_STAGES: RequeueStage[] = ["RELEVANCE", "AUTOMATION", "INGESTION", "INTELLIGENCE"];
// ponytail: one request publishes them one by one; past this many, press again
// or move the loop to a background job.
const REQUEUE_LIMIT = 500;

/**
 * Publishes the stage's job again for every tender stuck on it, the same job the
 * stage before would have published. `from` picks the stuck tenders: FAILED, or
 * QUEUED for longer than LIFECYCLE_SLOW_MS (a younger job may still be in the queue).
 * A tender whose job is sent moves to that stage's QUEUED with a fresh wait time;
 * one that still cannot be sent keeps its status.
 */
async function requeueStageFn(stage: RequeueStage, from: "FAILED" | "QUEUED") {
  const user = await requireUserAction();
  if (user.role !== "developer") throw new Error("Forbidden: developer role required");
  if (!REQUEUE_STAGES.includes(stage)) throw new Error(`Unknown stage: ${stage}`);
  if (from !== "FAILED" && from !== "QUEUED") throw new Error(`Unknown status: ${from}`);

  const tenders = await prisma.tenderMerged.findMany({
    where:
      from === "FAILED"
        ? { lifecycleStatus: `${stage}_FAILED` }
        : {
            lifecycleStatus: `${stage}_QUEUED`,
            lifecycleUpdatedAt: { lt: new Date(Date.now() - LIFECYCLE_SLOW_MS) },
          },
    select: {
      id: true,
      referenceNo: true,
      tenderType: true,
      tenderBrief: true,
      itemCategory: true,
      subCategory: true,
      value: true,
      estimatedBidValue: true,
    },
    orderBy: { lifecycleUpdatedAt: "asc" },
    take: REQUEUE_LIMIT,
  });

  let queued = 0;
  for (const tender of tenders) {
    const { id, referenceNo } = tender;
    let sent = false;
    if (stage === "RELEVANCE") {
      sent = await publishRelevance(tender);
    } else if (stage === "AUTOMATION") {
      sent = await publishTenderTask(
        tender.tenderType === "GEM"
          ? { type: "GEM_DOWNLOAD", tenderId: id, gemId: referenceNo, referenceNo, timestamp: Date.now() }
          : { type: "NON_GEM_DOWNLOAD", tenderId: id, referenceNo, timestamp: Date.now() },
      );
    } else if (stage === "INGESTION") {
      const files = await prisma.tenderFile.findMany({
        where: { tenderMergedId: id },
        select: INGESTION_FILE_SELECT,
        orderBy: { id: "asc" },
      });
      // Nothing to ingest: the download has to be requeued first.
      sent = files.length > 0 && (await publishIngestionTask({ referenceNo, files }));
    } else {
      sent = await publishAgentIntelligenceTask({
        payloadType: "analysis",
        referenceNo,
        company: "laser",
        tenderbrief: tender.tenderBrief ?? "",
        itemcategory: tender.itemCategory ?? "",
      });
    }
    if (!sent) continue;
    await setLifecycleStatus(referenceNo, `${stage}_QUEUED`);
    queued++;
  }

  return { stage, from, queued, notQueued: tenders.length - queued };
}

export const requeueStage = withLog(requeueStageFn, (result) => ({
  action: "UPDATE" as const,
  tableName: "TenderMerged",
  details: `Requeued ${result.stage} from ${result.from}: ${result.queued} queued, ${result.notQueued} not queued`,
}));

// A new batch starts a fresh count: tenders an earlier batch rejected go back to
// "not started", so the AI analysis page does not show them as rejected again.
// Their saved verdict (aiRelevanceValid, aiRelevanceReason) is untouched.
async function startAiAnalysisRunFn(): Promise<number> {
  await requireUserAction();
  const { count } = await prisma.tenderMerged.updateMany({
    where: { lifecycleStatus: TENDER_LIFECYCLE_STATUS.RELEVANCE_REJECTED },
    data: { lifecycleStatus: null, lifecycleUpdatedAt: null, lifecycleError: null },
  });
  return count;
}

export const startAiAnalysisRun = withLog(startAiAnalysisRunFn, (cleared) => ({
  action: "UPDATE" as const,
  tableName: "TenderMerged",
  details: `AI analysis run started; cleared ${cleared} rejected lifecycle statuses`,
}));

export const publishAiAnalysisJob = withLog(
  publishAiAnalysisJobFn,
  (result, params) => ({
    action: "CREATE" as const,
    tableName: "agent:relevance",
    recordId: undefined,
    referenceNo: params.referenceNo,
    details: `Published AI analysis job (sent=${result})`,
  }),
);

export async function saveAiRelevance(params: {
  tenderMergedId: number;
  valid: boolean;
  reason: string;
}) {
  await requireUserAction();
  const data = {
    aiRelevanceValid: params.valid,
    aiRelevanceReason: params.reason,
  };
  await prisma.tenderMerged.update({
    where: { id: params.tenderMergedId },
    data,
  });
  const referenceNo = (
    await prisma.tenderMerged.findUnique({
      where: { id: params.tenderMergedId },
      select: { referenceNo: true },
    })
  )?.referenceNo;

  logActivity({
    action: "UPDATE",
    tableName: "TenderMerged",
    recordId: String(params.tenderMergedId),
    referenceNo: referenceNo ?? undefined,
    details: `Set AI relevance valid=${params.valid} on tender #${params.tenderMergedId}`,
  });
}
