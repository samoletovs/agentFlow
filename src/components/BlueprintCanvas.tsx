import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useMemo, useState } from "react";
import type {
  AgentBlueprint,
  BlueprintFlow,
  BlueprintNode,
} from "../lib/blueprint";
import { layoutNodes } from "../lib/layout";

// Distinct, accessible palette for up to 6 concurrent flows.
// Avoids pure neon, keeps contrast above 4.5:1 on the dark canvas.
const FLOW_COLORS = [
  "#6c8cff", // accent blue
  "#3DC9A0", // brand emerald (matches nauroLabs)
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#a78bfa", // violet
  "#38bdf8", // sky
];

interface BlueprintCanvasProps {
  blueprint: AgentBlueprint;
  /** Selected flow id ("__all__" = union of all non-private flows). */
  flowId: string;
  /** When true, redact `private` nodes and skip `private` flows. */
  redactPrivate: boolean;
}

interface NodeData {
  node: BlueprintNode;
  redact: boolean;
  dim: boolean;
  [key: string]: unknown;
}

function BlueprintNodeView({ data }: NodeProps<Node<NodeData>>) {
  const { node, redact, dim } = data;
  const redacted = redact && node.private === true;
  const label = redacted ? "Restricted" : node.label;
  const detail = redacted ? "Sign in to view details" : node.detail;
  return (
    <div
      className={
        `bp-node${node.private ? " private" : ""}` +
        `${redacted ? " redacted" : ""}${dim ? " dim" : ""}`
      }
      data-kind={node.kind}
      title={node.resource ?? ""}
    >
      <Handle type="target" position={Position.Left} />
      <div className="kind">
        <span className={`kind-dot kind-dot-${node.kind}`} />
        {node.kind}
        {redacted ? <span className="lock" aria-hidden="true">·</span> : null}
      </div>
      <div className="label">{label}</div>
      {detail ? <div className="detail">{detail}</div> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { blueprint: BlueprintNodeView };

function selectFlows(
  blueprint: AgentBlueprint,
  flowId: string,
  redactPrivate: boolean,
): BlueprintFlow[] {
  const candidates =
    flowId === "__all__"
      ? blueprint.flows
      : blueprint.flows.filter((f) => f.id === flowId);
  return candidates.filter((f) => !redactPrivate || f.private !== true);
}

export function BlueprintCanvas({
  blueprint,
  flowId,
  redactPrivate,
}: BlueprintCanvasProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const visibleFlows = useMemo(
    () => selectFlows(blueprint, flowId, redactPrivate),
    [blueprint, flowId, redactPrivate],
  );

  // Restrict the node graph to nodes that participate in the visible flows so
  // single-flow views don't waste space on unrelated boxes.
  const visibleNodeIds = useMemo(() => {
    if (flowId === "__all__") return new Set(blueprint.nodes.map((n) => n.id));
    const ids = new Set<string>();
    for (const f of visibleFlows) {
      for (const s of f.steps) {
        ids.add(s.from);
        ids.add(s.to);
      }
    }
    return ids;
  }, [blueprint, flowId, visibleFlows]);

  const visibleNodes = blueprint.nodes.filter((n) => visibleNodeIds.has(n.id));
  const laidOut = useMemo(
    () => layoutNodes(visibleNodes, visibleFlows),
    [visibleNodes, visibleFlows],
  );

  // Build adjacency for hover-dim: keep the hovered node + its 1-hop neighbours
  // fully lit, dim the rest.
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of visibleNodes) m.set(n.id, new Set([n.id]));
    for (const f of visibleFlows) {
      for (const s of f.steps) {
        m.get(s.from)?.add(s.to);
        m.get(s.to)?.add(s.from);
      }
    }
    return m;
  }, [visibleNodes, visibleFlows]);

  const dimSet = useMemo(() => {
    if (!hoveredNode) return null;
    const keep = neighbours.get(hoveredNode) ?? new Set([hoveredNode]);
    const dim = new Set<string>();
    for (const n of visibleNodes) if (!keep.has(n.id)) dim.add(n.id);
    return dim;
  }, [hoveredNode, neighbours, visibleNodes]);

  const rfNodes: Node<NodeData>[] = laidOut.map((n) => ({
    id: n.id,
    type: "blueprint",
    position: { x: n.x, y: n.y },
    data: { node: n, redact: redactPrivate, dim: dimSet?.has(n.id) ?? false },
  }));

  const rfEdges: Edge[] = [];
  const seen = new Set<string>();
  visibleFlows.forEach((flow, flowIdx) => {
    const color = FLOW_COLORS[flowIdx % FLOW_COLORS.length];
    flow.steps.forEach((step, stepIdx) => {
      const key = `${flow.id}:${step.from}->${step.to}:${stepIdx}`;
      if (seen.has(key)) return;
      seen.add(key);
      const isDim =
        dimSet && (dimSet.has(step.from) || dimSet.has(step.to)) ? true : false;
      rfEdges.push({
        id: key,
        source: step.from,
        target: step.to,
        label: step.label,
        animated: !isDim,
        style: {
          stroke: color,
          strokeWidth: isDim ? 1 : 1.8,
          opacity: isDim ? 0.15 : 0.95,
        },
        labelStyle: {
          fill: "#dbe1ef",
          fontSize: 11,
          fontWeight: 500,
          opacity: isDim ? 0.2 : 1,
        },
        labelBgStyle: { fill: "#0f1830", fillOpacity: 0.85 },
        labelBgPadding: [4, 6],
        labelBgBorderRadius: 4,
      });
    });
  });

  if (visibleFlows.length === 0) {
    return (
      <div className="empty">
        <div>No public flows to show. Sign in to see private flows.</div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.1}
      maxZoom={1.5}
      onInit={(instance) => {
        // ReactFlow's initial fitView can fire before the container has
        // stable dimensions (toolbar reflow, banner mount). Re-fit on the
        // next animation frame to guarantee the graph is centred.
        requestAnimationFrame(() => instance.fitView({ padding: 0.18 }));
      }}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ animated: true }}
      onNodeMouseEnter={(_, n) => setHoveredNode(n.id)}
      onNodeMouseLeave={() => setHoveredNode(null)}
      onPaneClick={() => setHoveredNode(null)}
    >
      <Background variant={BackgroundVariant.Dots} color="#1a2440" gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
