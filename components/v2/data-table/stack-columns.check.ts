/**
 * Self-check for stacked columns. Run it with:
 *
 *   pnpm exec tsx components/v2/data-table/stack-columns.check.ts
 */
import assert from "node:assert/strict";
import { filterIds, leafColumns, stackColumns, type DataTableColumn } from "./types";

type Row = Record<string, string>;
const col = (id: string, extra: Partial<DataTableColumn<Row>> = {}): DataTableColumn<Row> => ({
  id,
  header: id,
  ...extra,
});

const columns = [
  col("a"),
  col("price", { width: 300 }),
  col("b", { frozen: true }),
  col("name", { extraFilters: [{ id: "kind", label: "Kind" }] }),
  col("lonely"),
];
const stacked = stackColumns(columns, [
  { header: "L1", members: ["name", "price", "missing"] },
  { header: "Alone", members: ["lonely", "absent"] },
]);

// The stack sits where its first column stood and is named by its first member.
assert.deepEqual(
  stacked.map((c) => c.id),
  ["a", "name", "b", "lonely"],
);
const l1 = stacked[1];
assert.equal(l1.header, "L1");
assert.equal(l1.width, 300);
// Members follow the stack's order, not the table's.
assert.deepEqual(
  l1.members?.map((m) => m.id),
  ["name", "price"],
);
// One member present is not a stack.
assert.equal(stacked[3].members, undefined);

// Filters, sort and export still see every field.
assert.deepEqual(
  leafColumns(stacked).map((c) => c.id),
  ["a", "name", "price", "b", "lonely"],
);
assert.deepEqual(filterIds(l1), ["name", "kind", "price"]);

// A frozen member pins the whole stack.
assert.equal(stackColumns(columns, [{ header: "X", members: ["b", "a"] }])[0].frozen, true);

// A stack's own cell rides on the folded column.
const whole = (row: Row) => row.a || null;
assert.equal(stackColumns(columns, [{ header: "X", members: ["a", "b"], cell: whole }])[0].cell, whole);

console.log("stack-columns: ok");
