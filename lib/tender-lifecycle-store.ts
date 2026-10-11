import "server-only";
import { prisma } from "@/lib/prisma";
import type { TenderLifecycleStatus } from "@/lib/tender-lifecycle";

/** The three lifecycle columns for a tender entering `status`. */
export function lifecycleData(status: TenderLifecycleStatus, error?: unknown) {
  return {
    lifecycleStatus: status,
    lifecycleUpdatedAt: new Date(),
    lifecycleError:
      error == null ? null : typeof error === "string" ? error : JSON.stringify(error),
  };
}

/**
 * Records where a tender is in the analysis chain (docs/tender-lifecycle.md §6).
 * Never throws: a status that could not be saved must not fail the publish or
 * webhook it describes.
 */
export async function setLifecycleStatus(
  referenceNo: string,
  status: TenderLifecycleStatus,
  error?: unknown,
) {
  try {
    await prisma.tenderMerged.updateMany({
      where: { referenceNo },
      data: lifecycleData(status, error),
    });
  } catch (err) {
    console.error(`[lifecycle] ${referenceNo} not set to ${status}:`, err);
  }
}

/** A relevance job was published, or could not be. */
export const setRelevanceQueued = (referenceNo: string, sent: boolean) =>
  sent
    ? setLifecycleStatus(referenceNo, "RELEVANCE_QUEUED")
    : setLifecycleStatus(referenceNo, "RELEVANCE_FAILED", "Relevance job not queued");
