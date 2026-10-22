/**
 * Standalone script to sync TenderMerged.contractNo + TenderMerged.tmNo
 * from the "CONT DUMP" Google Sheet, matched by QUOTATION_NO.
 *
 * Usage:
 *   npx tsx scripts/syncContractAndTmFromContDump.ts
 */
import "dotenv/config";
import { syncContractAndTmFromContDump } from "../services/contDumpSyncService";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=".repeat(60));
  console.log("  CONT DUMP Sync — contractNo + tmNo");
  console.log("=".repeat(60));

  const contractBefore = await prisma.tenderMerged.count({ where: { contractNo: { not: null } } });
  const tmBefore = await prisma.tenderMerged.count({ where: { tmNo: { not: null } } });
  console.log(`\n  Rows with contractNo before: ${contractBefore}`);
  console.log(`  Rows with tmNo before:       ${tmBefore}`);

  console.log("\n  Syncing from sheet...\n");
  const stats = await syncContractAndTmFromContDump();

  const contractAfter = await prisma.tenderMerged.count({ where: { contractNo: { not: null } } });
  const tmAfter = await prisma.tenderMerged.count({ where: { tmNo: { not: null } } });

  console.log(`\n  Detailed stats:`);
  console.log(`    Sheet data rows:            ${stats.sheetRows}`);
  console.log(`    Unique sheet quotations:    ${stats.uniqueQuotations}`);
  console.log(`    Multi-contract quotations:  ${stats.multiContractQuotations}`);
  console.log(`    Multi-tm quotations:       ${stats.multiTmQuotations}`);
  console.log(`    DB tenders scanned:         ${stats.totalTenders}`);
  console.log(`    Tenders updated:            ${stats.updated}`);
  console.log(`      contractNo written:       ${stats.updatedContract}`);
  console.log(`      tmNo written:             ${stats.updatedTm}`);
  console.log(`    Not found in sheet:         ${stats.notFound}`);
  console.log(`    Already up to date:         ${stats.skippedExisting}`);
  console.log(`    Errors:                     ${stats.errors}`);

  console.log(`\n  Rows with contractNo after:  ${contractAfter} (+${contractAfter - contractBefore})`);
  console.log(`  Rows with tmNo after:        ${tmAfter} (+${tmAfter - tmBefore})`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
