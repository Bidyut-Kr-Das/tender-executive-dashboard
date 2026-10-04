import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { createWebhookHandler, type WebhookEvent } from "@/lib/webhook-event";

const SUCCESS_EVENT = "file.parsed_success";
const FAILED_EVENT = "file.parsed_failed";

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

// Parsing is a side branch (docs/tender-lifecycle.md): it stores the result per file and publishes nothing.
async function handleParsingEvent(evt: WebhookEvent) {
  if (evt.event !== SUCCESS_EVENT && evt.event !== FAILED_EVENT) return { handled: false };

  const { referenceNo, file_link: fileLink } = evt.data;
  if (!fileLink) throw httpError("data.file_link is required", 400);

  const tender = await prisma.tenderMerged.findUnique({
    where: { referenceNo },
    select: { id: true },
  });
  if (!tender) throw httpError(`Reference not found: ${referenceNo}`, 404);

  const failed = evt.event === FAILED_EVENT || evt.data.error != null;
  const data = failed
    ? {
        parseStatus: "FAILED",
        parseError: typeof evt.data.error === "string" ? evt.data.error : JSON.stringify(evt.data.error ?? "Parsing failed"),
      }
    : {
        parseStatus: "COMPLETED",
        parseResult: (evt.data.result ?? Prisma.DbNull) as Prisma.InputJsonValue,
        parseError: null,
      };

  // Only a PENDING file is updated, so a retried event for a settled file is a no-op.
  const { count } = await prisma.tenderFile.updateMany({
    where: { tenderMergedId: tender.id, url: fileLink, parseStatus: "PENDING" },
    data,
  });
  if (count === 0) return { handled: false, reason: "no PENDING file for file_link" };

  return { handled: true, parseStatus: data.parseStatus };
}

export const POST = createWebhookHandler("Parsing", handleParsingEvent);
