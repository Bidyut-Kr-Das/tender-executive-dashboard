/**
 * Self-check for the result sync row mapping. Run it with:
 *
 *   npx tsx lib/result-sync.check.ts
 */
import assert from "node:assert/strict";
import { buildResultUpdate, mergeCompetitors, parseResultRows } from "./result-sync";

// TenderTiger row: Laser is L1, Tender247-only fields are null.
const [tiger] = parseResultRows({
  rows: [{
    referenceNo: " GEM/2026/B/1234567 ", reverseAuction: true, l1: "Laser Power & Infra Ltd", isLaser: true,
    contractAmount: "1.5 Cr", contractValue: "15000000", competitors: null, tenderStage: null, currentStatus: null,
  }],
});
assert.equal(tiger.referenceNo, "GEM/2026/B/1234567");
assert.deepEqual(buildResultUpdate(tiger, "Old Co"), {
  reverseAuctionApplicable: true,
  nameOfRank1: "Laser Power & Infra Ltd",
  valueOfRank1: "15000000",
  ourRank: "1",
  ourValue: "15000000",
});

// Tender247 row: competitors merge into the stored list, ourRank untouched.
const [t247] = parseResultRows({
  rows: [{
    referenceNo: "64265344B", reverseAuction: false, l1: "Other Cables Pvt Ltd", isLaser: false,
    contractAmount: "12,34,567", contractValue: "1234567",
    competitors: "A Ltd, B Ltd, Laser Power & Infra Ltd", tenderStage: "AOC", currentStatus: "AWARDED",
  }],
});
assert.deepEqual(buildResultUpdate(t247, "B Ltd - Z Ltd"), {
  reverseAuctionApplicable: false,
  nameOfRank1: "Other Cables Pvt Ltd",
  valueOfRank1: "1234567",
  currentStatus: "AWARDED",
  competitors: "B Ltd - Z Ltd - A Ltd - Laser Power & Infra Ltd",
});

assert.equal(mergeCompetitors("A - B", ["B", "A", ""]), null);
assert.equal(mergeCompetitors(null, ["A", "A", "B"]), "A - B");
assert.throws(() => parseResultRows({ rows: [{ referenceNo: "" }] }), /referenceNo is required/);
assert.throws(() => parseResultRows(null), /rows must be an array/);

console.log("result-sync checks passed");
