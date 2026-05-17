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
import { useMemo } from "react";
import type {
  AgentBlueprint,
  BlueprintFlow,
  BlueprintNode,
} from "../lib/blueprint";
import { layoutNodes } from "../lib/layout";

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
  [key: string]: unknown;
}

function BlueprintNodeView({ data }: NodeProps<Node<NodeData>>) {
  const { node, redact } = data;
  const redacted = redact && node.private === true;
  const label = redacted ? "Restricted" : node.label;
  const detail = redacted ? "Sign in to view details" : node.detail;
  return (
    <div
      className={`bp-node${node.private ? " private" : ""}${redacted ? " redacted" : ""}`}
      data-kind={node.kind}
      title={node.resource ?? ""}
    >
      <Handle type="target" position={Position.Left} />
      <div className="kind">{node.kind}</div>
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

  const rfNodes: Node<NodeData>[] = laidOut.map((n) => ({
    id: n.id,
    type: "blueprint",
    position: { x: n.x, y: n.y },
    data: { node: n, redact: redactPrivate },
  }));

  const rfEdges: Edge[] = [];
  const seen = new Set<string>();
  visibleFlows.forEach((flow, flowIdx) => {
    flow.steps.forEach((step, stepIdx) => {
      const key = `${flow.id}:${step.from}->${step.to}:${stepIdx}`;
      if (seen.has(key)) return;
      seen.add(key);
      rfEdges.push({
        id: key,
        source: step.from,
        target: step.to,
        label: step.label,
        animated: true,
        style: {
          stroke: flowIdx === 0 ? "#6c8cff" : "#22c55e",
          strokeWidth: 1.5,
        },
        labelStyle: { fill: "#aab2c7", fontSize: 11 },
        labelBgStyle: { fill: "#111a30" },
        labelBgPadding: [3, 5],
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
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ animated: true }}
    >
      <Background variant={BackgroundVariant.Dots} color="#1f2a44" gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
