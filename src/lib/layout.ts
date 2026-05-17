// Simple layered layout for blueprint nodes — no heavy graph library.
// We split nodes into columns by topological order over the union of flow steps,
// then stack within each column by insertion order.

import type { BlueprintNode, BlueprintFlow } from "./blueprint";

export interface LaidOutNode extends BlueprintNode {
  x: number;
  y: number;
}

const COL_WIDTH = 280;
const ROW_HEIGHT = 110;
const PADDING_X = 80;
const PADDING_Y = 60;

export function layoutNodes(
  nodes: BlueprintNode[],
  flows: BlueprintFlow[],
): LaidOutNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  const inEdges = new Map<string, Set<string>>();
  const outEdges = new Map<string, Set<string>>();
  for (const id of ids) {
    inEdges.set(id, new Set());
    outEdges.set(id, new Set());
  }
  for (const flow of flows) {
    for (const step of flow.steps) {
      if (!ids.has(step.from) || !ids.has(step.to)) continue;
      outEdges.get(step.from)!.add(step.to);
      inEdges.get(step.to)!.add(step.from);
    }
  }

  // Longest-path layering (Coffman–Graham approximation).
  const layer = new Map<string, number>();
  const remaining = new Set(ids);
  let depth = 0;
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) =>
      [...inEdges.get(id)!].every((from) => !remaining.has(from)),
    );
    if (ready.length === 0) {
      // Cycle — assign whatever's left to the current depth.
      for (const id of remaining) layer.set(id, depth);
      break;
    }
    for (const id of ready) {
      layer.set(id, depth);
      remaining.delete(id);
    }
    depth += 1;
  }

  const byLayer = new Map<number, BlueprintNode[]>();
  for (const node of nodes) {
    const l = layer.get(node.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(node);
  }

  const result: LaidOutNode[] = [];
  for (const [l, group] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    group.forEach((node, idx) => {
      result.push({
        ...node,
        x: PADDING_X + l * COL_WIDTH,
        y: PADDING_Y + idx * ROW_HEIGHT,
      });
    });
  }
  return result;
}
