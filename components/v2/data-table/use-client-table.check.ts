/**
 * Self-check for in-browser filtering and sorting. Run it with:
 *
 *   pnpm exec tsx components/v2/data-table/use-client-table.check.ts
 */
import assert from "node:assert/strict";
import { BLANK } from "./types";
import type { DataTableColumn } from "./types";
import { facetOptions, filterRows, sortRows } from "./use-client-table";

interface Row {
  id: number;
  party: string | null;
  amount: string;
  billed: string | null;
  done: string;
}

const rows: Row[] = [
  { id: 1, party: "Alpha Cables", amount: "₹1,200", billed: "2026-03-10T18:45:00.000Z", done: "Yes" },
  { id: 2, party: "beta wires", amount: "₹90", billed: "2026-01-05T06:00:00.000Z", done: "No" },
  { id: 3, party: null, amount: "", billed: null, done: "" },
  { id: 4, party: "Item 10", amount: "₹15,000", billed: "2025-12-31T06:00:00.000Z", done: "Y" },
  { id: 5, party: "Item 9", amount: "₹300", billed: "2026-03-01T06:00:00.000Z", done: "no" },
];

const columns: DataTableColumn<Row>[] = [
  { id: "party", header: "Party", text: (r) => r.party ?? "" },
  { id: "amount", header: "Amount" },
  { id: "billed", header: "Billed" },
  { id: "done", header: "Done" },
];
const values = { amount: (r: Row) => (r.amount ? Number(r.amount.replace(/[₹,]/g, "")) : null) };

const ids = (out: Row[]) => out.map((r) => r.id);
const filter = (filters: Parameters<typeof filterRows>[2]) =>
  ids(filterRows(rows, columns, filters, values));

// Contains ignores case.
assert.deepEqual(filter({ party: { text: "WIRES" } }), [2]);

// Blank picks rows with no value; picks combine as "any of".
assert.deepEqual(filter({ party: { select: [BLANK.value] } }), [3]);
assert.deepEqual(filter({ party: { select: [BLANK.value, "Item 9"] } }), [3, 5]);

// Date range is inclusive at both ends and drops rows with no date.
assert.deepEqual(
  filter({ billed: { dateRange: { startDate: "2026-01-05", endDate: "2026-03-01" } } }),
  [2, 5],
);
assert.deepEqual(filter({ billed: { dateRange: { startDate: "2026-03-02", endDate: "" } } }), [1]);

// Number range reads the typed value, not the "₹1,200" text.
assert.deepEqual(filter({ amount: { numberRange: { min: "300", max: "1200" } } }), [1, 5]);
assert.deepEqual(filter({ amount: { numberRange: { min: "", max: "100" } } }), [2]);

assert.deepEqual(filter({ done: { boolean: true } }), [1, 4]);
assert.deepEqual(filter({ done: { boolean: false } }), [2, 3, 5]);

// Filters on two columns must both hold.
assert.deepEqual(filter({ party: { text: "item" }, done: { boolean: true } }), [4]);

// Amounts sort as numbers; the empty one stays last either way.
assert.deepEqual(ids(sortRows(rows, { column: "amount", direction: "asc" }, values)), [2, 5, 1, 4, 3]);
assert.deepEqual(ids(sortRows(rows, { column: "amount", direction: "desc" }, values)), [4, 1, 5, 2, 3]);

// Text sorts ignore case and read "Item 9" before "Item 10".
assert.deepEqual(ids(sortRows(rows, { column: "party", direction: "asc" })), [1, 2, 5, 4, 3]);
assert.deepEqual(ids(sortRows(rows, null)), [1, 2, 3, 4, 5]);

assert.deepEqual(
  facetOptions(rows, columns[0]).map((o) => o.value),
  ["Alpha Cables", "beta wires", "Item 9", "Item 10"],
);

console.log("use-client-table: ok");
