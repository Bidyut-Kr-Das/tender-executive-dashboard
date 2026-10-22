import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { parseEmd, parseRupees } from "@/lib/rupees";

// Script: one-time cleanup of TenderMerged.value and TenderMerged.emd, using
// the same parsers as the Excel upload (lib/rupees.ts).
// Rule: a readable amount becomes plain rupees ("1.5 Cr" -> "15000000",
// "1,00,000 Rs" -> "100000", EMD "Advisory Bank: SBI | EMD Amount: 80000" ->
// "80000"); anything else ("NA", "Not visible", "EXEMPTION-BIS", PDF text)
// becomes "0", the same as an upload. Rows already in plain form are left alone.
// Usage: pnpm exec tsx scripts/sanitize-tender-values.ts          (dry run: prints the changes)
//        pnpm exec tsx scripts/sanitize-tender-values.ts --apply  (writes them)

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 500;

const FIELDS = [
  { field: "value", parse: parseRupees },
  { field: "emd", parse: parseEmd },
] as const;

async function main() {
  const rows = await prisma.tenderMerged.findMany({
    select: { id: true, referenceNo: true, value: true, emd: true },
  });

  const changes = FIELDS.flatMap(({ field, parse }) =>
    rows.flatMap((r) => {
      const current = r[field];
      if (current == null) return [];
      const amount = parse(current);
      const next = String(amount ?? 0);
      return next === current ? [] : [{ id: r.id, referenceNo: r.referenceNo, field, current, next, unreadable: amount === null }];
    }),
  );

  for (const { field } of FIELDS) {
    const mine = changes.filter((c) => c.field === field);
    const zeroed = mine.filter((c) => c.unreadable).length;
    console.log(`${field}: ${mine.length - zeroed} to convert, ${zeroed} unreadable to set to 0.`);
    for (const c of mine) {
      console.log(`  #${c.id} ${c.referenceNo}: ${JSON.stringify(c.current).slice(0, 60)} -> ${c.next}`);
    }
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    return;
  }

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const batch = changes.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((c) => prisma.tenderMerged.update({ where: { id: c.id }, data: { [c.field]: c.next } })),
    );
  }
  console.log(`\nUpdated ${changes.length} values.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
