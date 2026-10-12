/**
 * Script to publish COSTING_ATTACHMENT_PARSING jobs to the "tender:parsing" queue
 * for the tenders whose referenceNo you pass in.
 *
 * Usage:
 *   npx tsx scripts/publishCostingAttachmentParsingJob.ts <referenceNo> [referenceNo2 ...]
 */
import { prisma } from "../lib/prisma";
import { publishTenderParsingTask } from "../lib/queue/publisher";
import { describeTenderFile } from "../lib/tenderFileDescriptor";
import { closeConnection } from "../lib/rabbitmq";

async function main() {
  const referenceNos = process.argv.slice(2).map((r) => r.trim()).filter(Boolean);
  if (referenceNos.length === 0) {
    console.error("Usage: npx tsx scripts/publishCostingAttachmentParsingJob.ts <referenceNo> [referenceNo2 ...]");
    process.exit(1);
  }

  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const referenceNo of referenceNos) {
    try {
      const tender = await prisma.tenderMerged.findUnique({
        where: { referenceNo },
        select: {
          id: true,
          referenceNo: true,
          tenderFiles: {
            where: { tags: { has: "costingAttachment" } },
            select: { source: true, url: true },
            take: 1,
          },
        },
      });

      if (!tender) {
        console.warn(`  [SKIP] ${referenceNo}: tender not found`);
        skipped++;
        continue;
      }

      const tenderFile = tender.tenderFiles[0];
      if (!tenderFile) {
        console.warn(`  [SKIP] ${referenceNo}: no costingAttachment file`);
        skipped++;
        continue;
      }

      const { file_type, decrypted_fileId } = describeTenderFile(tenderFile);
      if (!decrypted_fileId) {
        console.warn(`  [SKIP] ${referenceNo}: costingAttachment has no resolvable file id`);
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
        console.log(`  [OK]   ${referenceNo} -> tender:parsing`);
        queued++;
      } else {
        console.warn(`  [FAIL] ${referenceNo}: publish returned false (RabbitMQ unavailable?)`);
        failed++;
      }
    } catch (err) {
      console.error(`  [ERR]  ${referenceNo}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`  Total:  ${referenceNos.length}`);
  console.log(`  Queued: ${queued}`);
  console.log(`  Skipped:${skipped}`);
  console.log(`  Failed: ${failed}`);
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
