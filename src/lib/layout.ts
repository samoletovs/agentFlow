// DAG layout for blueprint nodes using dagre — left-to-right by default.
// We feed dagre the visible nodes + edges and let it compute (x, y) positions
// that balance width and avoid the naive single-column stack we used before.

import dagre from "dagre";
import type { BlueprintNode, BlueprintFlow } from "./blueprint";

export interface LaidOutNode extends BlueprintNode {
  x: number;
  y: number;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 78;
const RANK_SEP = 60; // gap between layers (left-to-right)
const NODE_SEP = 32; // gap between siblings within a layer

export function layoutNodes(
  nodes: BlueprintNode[],
  flows: BlueprintFlow[],
): LaidOutNode[] {
  if (nodes.length === 0) return [];

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const seen = new Set<string>();
  for (const flow of flows) {
    for (const step of flow.steps) {
      if (!ids.has(step.from) || !ids.has(step.to)) continue;
      const key = `${step.from}->${step.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      g.setEdge(step.from, step.to);
    }
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    // dagre returns centre coordinates — convert to top-left for React Flow.
    return {
      ...n,
      x: (pos?.x ?? 0) - NODE_WIDTH / 2,
      y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
    };
  });
}
