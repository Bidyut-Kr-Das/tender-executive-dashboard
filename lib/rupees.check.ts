/**
 * Self-check for rupee parsing. Run it with:
 *
 *   pnpm exec tsx lib/rupees.check.ts
 */
import assert from "node:assert/strict";
import { parseRupees } from "./rupees";

const cases: [unknown, number | null][] = [
  ["1.5 Cr", 15000000],
  ["Rs 7.42 L", 742000],
  ["Rs. 8.09 Lakh", 809000],
  ["₹ 12,34,567", 1234567],
  ["₹12,34,567.50/-", 1234567.5],
  ["INR 6,50,00,000 only", 65000000],
  ["12.5 lakhs", 1250000],
  ["2 crores", 20000000],
  ["800k", 800000],
  ["297155", 297155],
  [" 48399.99 ", 48399.99],
  [1234567, 1234567],
  [0, 0],
  // Currency after the number, or on both sides.
  ["1,00,000 Rs", 100000],
  ["1,00,000 Rs.", 100000],
  ["1,00,000Rs", 100000],
  ["100000 INR", 100000],
  ["1,00,000 rupees", 100000],
  ["1,00,000 ₹", 100000],
  ["Rs. 1,00,000/- only", 100000],
  ["1,00,000/- Rs only", 100000],
  ["Rupees 5 lakh only", 500000],
  ["1.5 Cr Rs", 15000000],
  ["₹1.5Cr", 15000000],
  ["5 crs", 50000000],
  ["5 Lacs Rs.", 500000],
  ["0", 0],
  // Not amounts.
  ["", null],
  [null, null],
  [undefined, null],
  ["NA", null],
  ["Not visible", null],
  ["297155\r\nने और कानून के अनुसार", null],
  ["1.5 bn", null],
  ["-500", null],
  [-500, null],
  [Number.NaN, null],
];

for (const [input, expected] of cases) {
  assert.equal(parseRupees(input), expected, `parseRupees(${JSON.stringify(input)})`);
}
console.log(`rupees: ${cases.length} checks passed`);
