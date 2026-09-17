import type { AgentBlueprint } from "./blueprint";
import type { DispatchFlow, DispatchModel, DispatchNode, DispatchStep } from "./dispatchTypes";

export function createDispatchModel(
  blueprint: AgentBlueprint,
  redactPrivate: boolean,
): DispatchModel {
  const nodes: DispatchNode[] = [];
  const nodesById = new Map<string, DispatchNode>();

  for (const node of blueprint.nodes) {
    if (nodesById.has(node.id)) {
      throw new Error("Dispatch model contains duplicate node IDs.");
    }
    const restricted = redactPrivate && node.private === true;
    const projected: DispatchNode = {
      id: node.id,
      kind: node.kind,
      label: restricted ? "Restricted component" : node.label,
      private: node.private === true,
      restricted,
      ...(!restricted && node.detail !== undefined ? { detail: node.detail } : {}),
      ...(!restricted && node.resource !== undefined ? { resource: node.resource } : {}),
      ...(!restricted && node.url !== undefined ? { url: node.url } : {}),
    };
    nodes.push(projected);
    nodesById.set(node.id, projected);
  }

  const flows: DispatchFlow[] = [];
  const flowIds = new Set<string>();
  for (const flow of blueprint.flows) {
    if (flowIds.has(flow.id)) {
      throw new Error("Dispatch model contains duplicate flow IDs.");
    }
    flowIds.add(flow.id);
    const hidden = redactPrivate && flow.private === true;
    const steps: DispatchStep[] = [];
    for (const [index, step] of flow.steps.entries()) {
      const source = nodesById.get(step.from);
      const destination = nodesById.get(step.to);
      if (!source || !destination) {
        throw new Error("Dispatch model contains a step that references a missing node.");
      }
      if (hidden) continue;
      steps.push({
        id: `${flow.id}:${index}`,
        flowId: flow.id,
        flowLabel: flow.label,
        index,
        from: source.id,
        to: destination.id,
        fromLabel: source.label,
        toLabel: destination.label,
        ...(step.label !== undefined ? { label: step.label } : {}),
        sourceChanged: index > 0 && flow.steps[index - 1].to !== step.from,
      });
    }
    if (hidden) continue;
    flows.push({
      id: flow.id,
      label: flow.label,
      private: flow.private === true,
      ...(flow.trigger !== undefined ? { trigger: flow.trigger } : {}),
      steps,
    });
  }

  return {
    project: blueprint.project,
    agent: blueprint.agent,
    summary: blueprint.summary,
    nodes,
    flows,
  };
}

export function getFlowNodes(
  model: DispatchModel,
  flow: DispatchFlow | undefined,
): readonly DispatchNode[] {
  if (!flow) return model.nodes;
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const participating = new Set<string>();
  for (const step of flow.steps) {
    if (!nodeIds.has(step.from) || !nodeIds.has(step.to)) {
      throw new Error("Dispatch flow references a node outside the model.");
    }
    participating.add(step.from);
    participating.add(step.to);
  }
  return model.nodes.filter((node) => participating.has(node.id));
}
