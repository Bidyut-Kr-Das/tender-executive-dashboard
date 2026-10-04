import { prisma } from "@/lib/prisma";
import { createWebhookHandler, type WebhookEvent } from "@/lib/webhook-event";
import { publishAgentIntelligenceTask, requireClientId } from "@/lib/queue/publisher";

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

async function handleIngestionEvent(evt: WebhookEvent) {
  // Failure and non-success events are only logged.
  if (!evt.event.endsWith("_success") || evt.data.error) return { handled: false };

  requireClientId("TENDER_AGENT_INTELLIGENCE_CLIENT_ID");

  const { referenceNo } = evt.data;
  const tender = await prisma.tenderMerged.findUnique({
    where: { referenceNo },
    select: { tenderBrief: true, itemCategory: true },
  });
  if (!tender) throw httpError(`Reference not found: ${referenceNo}`, 404);

  // Publish failure must not fail the webhook (docs/tender-lifecycle.md §9).
  const intelligenceQueued = await publishAgentIntelligenceTask({
    payloadType: "analysis",
    referenceNo,
    company: "laser",
    tenderbrief: tender.tenderBrief ?? "",
    itemcategory: tender.itemCategory ?? "",
  });
  if (!intelligenceQueued) {
    console.warn(`[ingestion] Intelligence job not queued for ${referenceNo} (RabbitMQ unavailable?)`);
  }

  return { handled: true, intelligenceQueued };
}

export const POST = createWebhookHandler("Ingestion", handleIngestionEvent);
