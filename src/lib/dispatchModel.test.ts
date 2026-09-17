import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import agentMode from "../blueprints/agentMode.json";
import atlas from "../blueprints/atlas.json";
import autoRefine from "../blueprints/autoRefine.json";
import foundryLab from "../blueprints/foundryLab.json";
import mindMe from "../blueprints/mindMe.json";
import turgo from "../blueprints/turgo.json";
import schema from "./agent-blueprint.v1.schema.json";
import type { AgentBlueprint, BlueprintNode } from "./blueprint";
import { createDispatchModel, getFlowNodes } from "./dispatchModel";

function fixture(): AgentBlueprint {
  return {
    version: "1.0",
    project: "dispatchLab",
    agent: "Dispatch agent",
    summary: "A public description of the cooperating components.",
    nodes: [
      { id: "a", kind: "compute", label: "Dispatcher", detail: "Coordinates work.", resource: "public-resource", url: "https://example.invalid/public" },
      { id: "b", kind: "data", label: "private-label-sentinel", detail: "private-detail-sentinel", resource: "private-resource-sentinel", url: "https://example.invalid/private-url-sentinel", private: true },
      { id: "c", kind: "tool", label: "Tool", private: false },
      { id: "unused", kind: "repo", label: "Reference" },
    ],
    flows: [
      {
        id: "work",
        label: "Public work",
        trigger: "Public trigger",
        steps: [
          { from: "a", to: "b", label: "Read" },
          { from: "b", to: "a", label: "Return" },
          { from: "a", to: "b", label: "Read" },
          { from: "a", to: "c" },
          { from: "c", to: "c", label: "Local continuation" },
        ],
      },
      {
        id: "private_flow_sentinel",
        label: "private-flow-label-sentinel",
        trigger: "private-trigger-sentinel",
        private: true,
        steps: [{ from: "a", to: "b", label: "private-step-label-sentinel" }],
      },
    ],
  };
}

describe("createDispatchModel", () => {
  it("physically omits restricted metadata and private flows from the public projection", () => {
    const input = fixture();
    const extendedPrivateNode: BlueprintNode & { title: string; raw: { value: string } } = {
      ...input.nodes[1],
      title: "private-title-sentinel",
      raw: { value: "private-raw-sentinel" },
    };
    input.nodes[1] = extendedPrivateNode;
    const model = createDispatchModel(input, true);
    expect(model.project).toBe(input.project);
    expect(model.agent).toBe(input.agent);
    expect(model.summary).toBe(input.summary);
    expect(model.nodes[1]).toEqual({
      id: "b", kind: "data", label: "Restricted component", private: true, restricted: true,
    });
    for (const field of ["detail", "resource", "url", "title", "raw"]) {
      expect(Object.hasOwn(model.nodes[1], field)).toBe(false);
    }
    expect(model.flows.map((flow) => flow.id)).toEqual(["work"]);
    expect(JSON.stringify(model)).not.toContain("private-");
    expect(JSON.stringify(model)).not.toContain("private_flow_sentinel");
    expect(model.flows[0].steps[0].toLabel).toBe("Restricted component");
    expect(model.flows[0].steps[1].fromLabel).toBe("Restricted component");
  });

  it("preserves permitted metadata and original privacy flags without retaining raw objects", () => {
    const input = fixture();
    const model = createDispatchModel(input, false);
    expect(model.nodes[1]).toEqual({ ...input.nodes[1], restricted: false });
    expect(model.nodes[0]).toEqual({ ...input.nodes[0], private: false, restricted: false });
    expect(model.nodes[2].private).toBe(false);
    expect(model.flows[1].private).toBe(true);
    expect(model.flows[1].label).toBe(input.flows[1].label);
    expect(model.flows[1].trigger).toBe(input.flows[1].trigger);
    expect(model.flows[1].steps[0].label).toBe(input.flows[1].steps[0].label);
    expect(model.nodes[0]).not.toBe(input.nodes[0]);
    expect(model.flows[0]).not.toBe(input.flows[0]);
    expect(model.flows[0].steps[0]).not.toBe(input.flows[0].steps[0]);
    expect(Object.hasOwn(model.nodes[2], "detail")).toBe(false);
    expect(Object.hasOwn(model.nodes[2], "url")).toBe(false);
    expect(Object.hasOwn(model.flows[0].steps[3], "label")).toBe(false);
  });

  it("uses source privacy flags, not sensitive-looking identifiers or service names", () => {
    const input = fixture();
    input.nodes[0] = {
      id: "a", kind: "secret", label: "Key Vault", resource: "private-looking-resource",
      url: "https://example.invalid/secret-looking-path", private: false,
    };
    const model = createDispatchModel(input, true);
    expect(model.nodes[0]).toEqual({ ...input.nodes[0], restricted: false });
    expect(model.nodes[1].restricted).toBe(true);
  });

  it("preserves repeated calls, return edges, branches, self-edges and occurrence ordering", () => {
    const input = fixture();
    const flow = createDispatchModel(input, true).flows[0];
    expect(flow.steps.map((step) => step.id)).toEqual(["work:0", "work:1", "work:2", "work:3", "work:4"]);
    expect(flow.steps.map((step) => [step.from, step.to])).toEqual(input.flows[0].steps.map((step) => [step.from, step.to]));
    expect(flow.steps.map((step) => step.index)).toEqual([0, 1, 2, 3, 4]);
    expect(flow.steps.map((step) => step.sourceChanged)).toEqual([false, false, false, true, false]);
    expect(flow.steps.every((step) => step.flowId === "work" && step.flowLabel === "Public work")).toBe(true);
    expect(flow.steps[0]).not.toBe(flow.steps[2]);
  });

  it("does not mutate even deeply frozen blueprint input", () => {
    const input = fixture();
    const before = structuredClone(input);
    input.nodes.forEach(Object.freeze);
    input.flows.forEach((flow) => {
      flow.steps.forEach(Object.freeze);
      Object.freeze(flow.steps);
      Object.freeze(flow);
    });
    Object.freeze(input.nodes);
    Object.freeze(input.flows);
    Object.freeze(input);
    createDispatchModel(input, true);
    createDispatchModel(input, false);
    expect(input).toEqual(before);
  });

  it("supports empty node collections, empty flow collections and empty flows", () => {
    const input = fixture();
    input.nodes = [];
    input.flows = [{ id: "empty", label: "Empty", steps: [] }];
    expect(createDispatchModel(input, true).flows[0].steps).toEqual([]);
    expect(createDispatchModel(input, true).nodes).toEqual([]);
    input.flows = [];
    expect(createDispatchModel(input, true).flows).toEqual([]);
  });

  it("rejects duplicate node IDs and flow IDs with value-free errors", () => {
    const duplicateNode = fixture();
    duplicateNode.nodes.push({ ...duplicateNode.nodes[1] });
    expect(() => createDispatchModel(duplicateNode, true)).toThrowError("Dispatch model contains duplicate node IDs.");
    const duplicateFlow = fixture();
    duplicateFlow.flows.push({ ...duplicateFlow.flows[1] });
    expect(() => createDispatchModel(duplicateFlow, true)).toThrowError("Dispatch model contains duplicate flow IDs.");
  });

  it.each(["from", "to"] as const)("rejects dangling %s references, including hidden-flow references", (field) => {
    for (const flowIndex of [0, 1]) {
      const input = fixture();
      input.flows[flowIndex].steps[0][field] = "private-missing-reference-sentinel";
      expect(() => createDispatchModel(input, true)).toThrowError(
        "Dispatch model contains a step that references a missing node.",
      );
    }
  });
});

describe("getFlowNodes", () => {
  it("returns all nodes for overview and participating nodes in stable model order for a flow", () => {
    const model = createDispatchModel(fixture(), true);
    expect(getFlowNodes(model, undefined)).toBe(model.nodes);
    expect(getFlowNodes(model, model.flows[0])).toEqual(model.nodes.slice(0, 3));
    expect(getFlowNodes(model, { id: "empty", label: "Empty", private: false, steps: [] })).toEqual([]);
    expect(getFlowNodes(model, model.flows[0])[1].restricted).toBe(true);
  });

  it("does not silently remove unknown participating nodes", () => {
    const model = createDispatchModel(fixture(), true);
    const flow = { ...model.flows[0], steps: [{ ...model.flows[0].steps[0], to: "missing" }] };
    expect(() => getFlowNodes(model, flow)).toThrowError("Dispatch flow references a node outside the model.");
  });
});

const ajv = new Ajv2020();
addFormats(ajv);
const validateBlueprint = ajv.compile<AgentBlueprint>(schema);

describe.each([
  ["mindMe", mindMe], ["agentMode", agentMode], ["atlas", atlas],
  ["autoRefine", autoRefine], ["foundryLab", foundryLab], ["turgo", turgo],
])("real blueprint: %s", (_project, input) => {
  it("preserves every visible occurrence and strips all restricted metadata", () => {
    if (!validateBlueprint(input)) throw new Error("A real blueprint fixture does not match the existing schema.");
    const blueprint: AgentBlueprint = input;
    for (const redactPrivate of [false, true]) {
      const model = createDispatchModel(blueprint, redactPrivate);
      const visibleFlows = blueprint.flows.filter((flow) => !redactPrivate || !flow.private);
      expect(model.flows.length).toBe(visibleFlows.length);
      expect(model.nodes.length).toBe(blueprint.nodes.length);
      for (const [index, projected] of model.nodes.entries()) {
        expect(projected.private).toBe(blueprint.nodes[index].private === true);
        expect(projected.restricted).toBe(redactPrivate && blueprint.nodes[index].private === true);
        if (projected.restricted) {
          expect(projected.label === "Restricted component").toBe(true);
          expect(Object.hasOwn(projected, "detail")).toBe(false);
          expect(Object.hasOwn(projected, "resource")).toBe(false);
          expect(Object.hasOwn(projected, "url")).toBe(false);
        }
      }
      for (const [index, flow] of model.flows.entries()) {
        expect(flow.id === visibleFlows[index].id).toBe(true);
        expect(flow.steps.length).toBe(visibleFlows[index].steps.length);
        expect(new Set(flow.steps.map((step) => step.id)).size).toBe(flow.steps.length);
        const participating = new Set(getFlowNodes(model, flow).map((node) => node.id));
        expect(flow.steps.every((step) => participating.has(step.from) && participating.has(step.to))).toBe(true);
        flow.steps.forEach((step, stepIndex) => {
          const original = visibleFlows[index].steps[stepIndex];
          expect(step.from === original.from && step.to === original.to && step.label === original.label).toBe(true);
          expect(step.sourceChanged).toBe(stepIndex > 0 && flow.steps[stepIndex - 1].to !== step.from);
        });
      }
    }
  });
});
