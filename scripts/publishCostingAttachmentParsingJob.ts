/**
 * Script to publish COSTING_ATTACHMENT_PARSING jobs to the "tender:parsing" queue.
 *
 * Usage:
 *   pnpm exec tsx scripts/publishCostingAttachmentParsingJob.ts                       # all tenders with a costing attachment
 *   pnpm exec tsx scripts/publishCostingAttachmentParsingJob.ts <referenceNo> [...]    # only these tenders
 */
import { prisma } from "../lib/prisma";
import { publishTenderParsingTask } from "../lib/queue/publisher";
import { describeTenderFile } from "../lib/tenderFileDescriptor";
import { closeConnection } from "../lib/rabbitmq";

const FILE_SELECT = {
  id: true,
  referenceNo: true,
  tenderFiles: {
    where: { tags: { has: "costingAttachment" } },
    select: { source: true, url: true },
    take: 1,
  },
} as const;

async function main() {
  const referenceNos = process.argv.slice(2).map((r) => r.trim()).filter(Boolean);
  const all = referenceNos.length === 0;

  const tenders = await prisma.tenderMerged.findMany({
    where: all
      ? { tenderFiles: { some: { tags: { has: "costingAttachment" } } } }
      : { referenceNo: { in: referenceNos } },
    select: FILE_SELECT,
    orderBy: { id: "asc" },
  });

  if (all) console.log(`[publishCostingAttachmentParsingJob] ${tenders.length} tenders with a costing attachment\n`);

  const found = new Set(tenders.map((t) => t.referenceNo));
  for (const ref of referenceNos) {
    if (!found.has(ref)) console.warn(`  [SKIP] ${ref}: tender not found`);
  }

  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const tender of tenders) {
    const label = tender.referenceNo;
    try {
      const tenderFile = tender.tenderFiles[0];
      if (!tenderFile) {
        console.warn(`  [SKIP] ${label}: no costingAttachment file`);
        skipped++;
        continue;
      }

      const { file_type, decrypted_fileId } = describeTenderFile(tenderFile);
      if (!decrypted_fileId) {
        console.warn(`  [SKIP] ${label}: costingAttachment has no resolvable file id`);
        skipped++;
        continue;
      }

      const ok = await publishTenderParsingTask({
        type: "COSTING_ATTACHMENT_PARSING",
        tenderId: tender.id,
        referenceNo: tender.referenceNo,
        file_link: tenderFile.url ?? "",
        file_type,
        decrypted_fileId,
        timestamp: Date.now(),
      });

      if (ok) {
        console.log(`  [OK]   ${label} -> tender:parsing`);
        queued++;
      } else {
        console.warn(`  [FAIL] ${label}: publish returned false (RabbitMQ unavailable?)`);
        failed++;
      }
    } catch (err) {
      console.error(`  [ERR]  ${label}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`  Found:   ${tenders.length}`);
  console.log(`  Queued:  ${queued}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed:  ${failed}`);
}

main()
  .catch((err) => {
    console.error("\nScript failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeConnection();
  });
