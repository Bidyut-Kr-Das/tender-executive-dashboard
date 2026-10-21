import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { parseRupees } from "@/lib/rupees";

// Script: one-time cleanup of TenderMerged.value, using the same parser as the
// Excel upload (lib/rupees.ts).
// Rule: a readable amount becomes plain rupees ("1.5 Cr" -> "15000000",
// "1,00,000 Rs" -> "100000"); anything else ("NA", "Not visible", PDF text)
// becomes "0", the same as an upload. Rows already in plain form are left alone.
// Usage: pnpm exec tsx scripts/sanitize-tender-values.ts          (dry run: prints the changes)
//        pnpm exec tsx scripts/sanitize-tender-values.ts --apply  (writes them)

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 500;

async function main() {
  const rows = await prisma.tenderMerged.findMany({
    where: { value: { not: null } },
    select: { id: true, referenceNo: true, value: true },
  });

  const changes = rows.flatMap((r) => {
    const amount = parseRupees(r.value);
    const next = String(amount ?? 0);
    return next === r.value ? [] : [{ ...r, next, unreadable: amount === null }];
  });
  const zeroed = changes.filter((c) => c.unreadable).length;

  console.log(`Checked ${rows.length} values: ${changes.length - zeroed} to convert, ${zeroed} unreadable to set to 0.`);
  for (const c of changes) {
    const before = JSON.stringify(c.value).slice(0, 60);
    console.log(`  #${c.id} ${c.referenceNo}: ${before} -> ${c.next}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    return;
  }

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const batch = changes.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((c) => prisma.tenderMerged.update({ where: { id: c.id }, data: { value: c.next } })),
    );
  }
  console.log(`\nUpdated ${changes.length} tenders.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
