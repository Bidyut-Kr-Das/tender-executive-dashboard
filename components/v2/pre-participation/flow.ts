import {
  FLOW_TREES,
  ancestorsOf,
  flatten,
  type FlowNode,
} from "@/components/participation-flow/tree";

/** A filter the flow sets; the tree's own type, so the two cannot drift. */
export type FlowFilter = FlowNode["filter"];

export type FlowTone = "good" | "bad" | "warn" | "neutral";

// What a stage means for the bid: won, lost, or waiting on someone.
const TONES: Record<string, FlowTone> = {
  weL1: "good",
  contractReceived: "good",
  financialWeL1: "good",
  financialContractReceived: "good",
  weLost: "bad",
  financialWeLost: "bad",
  raPending: "warn",
  expRaDate: "warn",
  contractPending: "warn",
  financialContractPending: "warn",
  technicalNotOpen: "warn",
  financialNotOpen: "warn",
};

export const toneOf = (node: FlowNode): FlowTone => TONES[node.id] ?? "neutral";

// v1 sets this with every path; the server reads it as "participated".
const PARTICIPATED: FlowFilter = "participatedTotal";

/**
 * The filters after a node is pressed. One path is active at a time: the
 * filters are ANDed, so two branches together match nothing. Pressing the
 * deepest active node steps back to its parent.
 */
export function pressNode(active: FlowFilter[], tree: FlowNode, node: FlowNode): FlowFilter[] {
  const above = ancestorsOf(tree, node.id).map((n) => n.filter);
  if (!active.includes(node.filter)) return [PARTICIPATED, ...above, node.filter];
  return above.length > 0 ? [PARTICIPATED, ...above] : [];
}

/** The active nodes of the first tree that has any, root first. */
export function activePath(active: FlowFilter[]): FlowNode[] {
  for (const { tree } of FLOW_TREES) {
    const nodes = flatten(tree).filter((n) => active.includes(n.filter));
    if (nodes.length > 0) return nodes;
  }
  return [];
}
