/**
 * Backfill: set category = Manufacturing on TenderMerged rows where aiRelevanceValid = true.
 * Only touches rows with no category yet (never overwrites).
 *
 * Usage:
 *   npx tsx scripts/backfillManufacturingCategory.ts            # dry run, counts only
 *   npx tsx scripts/backfillManufacturingCategory.ts --apply    # write changes
 */
import { prisma } from "../lib/prisma";
import { TENDER_CATEGORIES } from "../lib/tender-categories";

const APPLY = process.argv.includes("--apply");

async function main() {
  const where = {
    aiRelevanceValid: true,
    OR: [{ category: null }, { category: "" }],
  };

  const count = await prisma.tenderMerged.count({ where });
  console.log(`[backfill-category] ${count} rows with aiRelevanceValid=true and no category.`);

  if (!APPLY) {
    console.log("[backfill-category] Dry run. Re-run with --apply to update.");
    return;
  }

  const result = await prisma.tenderMerged.updateMany({
    where,
    data: { category: TENDER_CATEGORIES.MANUFACTURING, subCategory: null },
  });
  console.log(`[backfill-category] Updated ${result.count} rows to ${TENDER_CATEGORIES.MANUFACTURING}.`);
}

main()
  .catch((err) => {
    console.error("[backfill-category] Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
