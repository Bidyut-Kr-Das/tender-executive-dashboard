/**
 * Self-check for EPC subcategory derivation. Run it with:
 *
 *   npx tsx lib/tender-categories.check.ts
 *
 * resolveEpcSubCategory is pure, so the assertions only inspect the returned
 * subcategory string.
 */
import assert from "node:assert/strict";
import { resolveEpcSubCategory } from "@/lib/tender-categories";

const FB = "Solar";

function sub(brief: unknown, org: unknown = "", fallback = FB): string {
  return resolveEpcSubCategory(brief, org, fallback);
}

// No rule matches -> user selection kept.
assert.equal(sub("Supply of LT panels"), FB);

// Power Transmission: opgw without supply.
assert.equal(sub("OPGW supply work", "", FB), FB); // has "supply" -> no match
assert.equal(sub("OPGW stringing work"), "Power Transmission");
assert.equal(sub("OPGW supply and laying"), FB); // "supply" present -> skip rule
// opgw + supply but explicit transmission word still matches rule2.
assert.equal(sub("OPGW supply and transmission line"), "Power Transmission");

// Power Transmission: transmission word.
assert.equal(sub("400kV transmission line package"), "Power Transmission");
assert.equal(sub("TRANSMISSION tower"), "Power Transmission");

// Power Distribution.
assert.equal(sub("Distribution of power in city"), "Power Distribution");
assert.equal(sub("Under ground cabling work"), "Power Distribution");
assert.equal(sub("Underground cabling"), "Power Distribution");
assert.equal(sub("under the ground"), "Power Distribution");
assert.equal(sub("under water pipeline"), FB); // only "under", no "ground"

// Ground rules: Railways always.
assert.equal(sub("400kV transmission line", "Northern Railway"), "Railways");
assert.equal(sub("Distribution of power", "Southern Railways"), "Railways");
assert.equal(sub("PIJF cable work"), "Railways");
assert.equal(sub("distribution work", "Indian Railways"), "Railways");

// Precedence: Railways outranks transmission/distribution; transmission outranks distribution.
assert.equal(sub("transmission and distribution", "Central Railway"), "Railways");
assert.equal(sub("transmission and distribution work"), "Power Transmission");

// Case-insensitivity + coercion.
assert.equal(sub("pIjF"), "Railways");
assert.equal(sub(null, null), FB);
assert.equal(sub(undefined, "RAILWAY"), "Railways");

console.log("tender-categories.check: all assertions passed");
