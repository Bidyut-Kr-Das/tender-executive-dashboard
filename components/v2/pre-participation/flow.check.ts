/**
 * Self-check for the flow band's path rules. Run it with:
 *
 *   npx tsx --tsconfig tsconfig.json components/v2/pre-participation/flow.check.ts
 */
import assert from "node:assert/strict";
import {
  WITHOUT_RA_TREE,
  WITH_RA_TREE,
  flatten,
} from "@/components/participation-flow/tree";
import { activePath, pressNode } from "./flow";

const node = (tree: typeof WITH_RA_TREE, id: string) => flatten(tree).find((n) => n.id === id)!;

// Pressing a node selects it with everything above it.
const weL1 = pressNode([], WITH_RA_TREE, node(WITH_RA_TREE, "weL1"));
assert.deepEqual(weL1, ["participatedTotal", "participatedWithRa", "raDone", "weL1"]);
assert.deepEqual(
  activePath(weL1).map((n) => n.id),
  ["withRa", "raDone", "weL1"],
);

// A sibling replaces the path instead of joining it.
assert.deepEqual(pressNode(weL1, WITH_RA_TREE, node(WITH_RA_TREE, "weLost")), [
  "participatedTotal",
  "participatedWithRa",
  "raDone",
  "weLost",
]);

// So does a node of the other tree.
const technical = pressNode(weL1, WITHOUT_RA_TREE, node(WITHOUT_RA_TREE, "technicalOpen"));
assert.deepEqual(technical, ["participatedTotal", "participatedWithoutRa", "technicalOpen"]);

// Pressing an active node clears it and everything below it.
assert.deepEqual(pressNode(weL1, WITH_RA_TREE, node(WITH_RA_TREE, "raDone")), [
  "participatedTotal",
  "participatedWithRa",
]);

// Pressing the active root clears the flow.
assert.deepEqual(pressNode(weL1, WITH_RA_TREE, WITH_RA_TREE), []);

console.log("flow.check ok");
