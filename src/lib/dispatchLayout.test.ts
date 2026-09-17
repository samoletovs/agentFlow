import { describe, expect, it } from "vitest";
import agentMode from "../blueprints/agentMode.json";
import atlas from "../blueprints/atlas.json";
import autoRefine from "../blueprints/autoRefine.json";
import foundryLab from "../blueprints/foundryLab.json";
import mindMe from "../blueprints/mindMe.json";
import turgo from "../blueprints/turgo.json";
import type { NodeKind } from "./blueprint";
import type { DispatchFlow, DispatchNode, DispatchStep } from "./dispatchTypes";
import {
  dispatchCurve,
  dispatchCurvePath,
  dispatchDestinationCue,
  dispatchFocusPoint,
  dispatchFollowView,
  dispatchMechanism,
  dispatchPlaybackPose,
  layoutDispatchRoom,
  pointOnDispatchCurve,
  resolveDispatchStep,
  wrapDispatchLabel,
} from "./dispatchLayout";

const kinds: readonly NodeKind[] = ["channel", "trigger", "compute", "agent", "tool", "data", "secret", "job", "repo", "pwa"];

interface BlueprintFixture {
  readonly project: string;
  readonly nodes: readonly { id: string; kind: string; label: string; private?: boolean }[];
  readonly flows: readonly {
    id: string;
    label: string;
    private?: boolean;
    steps: readonly { from: string; to: string; label?: string }[];
  }[];
}

function kindFromFixture(value: string): NodeKind {
  const kind = kinds.find((candidate) => candidate === value);
  if (!kind) throw new Error("Unsupported fixture kind");
  return kind;
}

function fixtureView(fixture: BlueprintFixture) {
  const nodes: DispatchNode[] = fixture.nodes.map((node) => ({
    id: node.id,
    label: node.private ? "Restricted component" : node.label,
    kind: kindFromFixture(node.kind),
    private: node.private === true,
    restricted: node.private === true,
  }));
  const label = (id: string) => nodes.find((node) => node.id === id)?.label ?? "Unavailable";
  const flows: DispatchFlow[] = fixture.flows.filter((flow) => !flow.private).map((flow) => ({
    id: flow.id,
    label: flow.label,
    private: false,
    steps: flow.steps.map((step, index) => ({
      id: `${flow.id}:${index}`,
      flowId: flow.id,
      flowLabel: flow.label,
      index,
      from: step.from,
      to: step.to,
      fromLabel: label(step.from),
      toLabel: label(step.to),
      label: step.label,
      sourceChanged: index > 0 && flow.steps[index - 1].to !== step.from,
    })),
  }));
  return { nodes, flows };
}

const node = (id: string, kind: NodeKind = "compute"): DispatchNode => ({
  id, kind, label: id, private: false, restricted: false,
});

function flowFor(pairs: readonly (readonly [string, string])[]): DispatchFlow {
  return {
    id: "flow", label: "Declared handoffs", private: false,
    steps: pairs.map(([from, to], index): DispatchStep => ({
      id: `step:${index}`, flowId: "flow", flowLabel: "Declared handoffs", index,
      from, to, fromLabel: from, toLabel: to, sourceChanged: false,
    })),
  };
}

describe("Dispatch room layout", () => {
  it.each([agentMode, atlas, autoRefine, foundryLab, mindMe, turgo])(
    "places every $project component in finite, non-overlapping bays",
    (fixture) => {
      const { nodes, flows } = fixtureView(fixture);
      const layout = layoutDispatchRoom(nodes, flows);
      const again = layoutDispatchRoom(nodes, flows);
      expect(layout).toEqual(again);
      expect(layout.placements).toHaveLength(nodes.length);
      expect(new Set(layout.placements.map((placement) => placement.node.id)).size).toBe(nodes.length);
      expect(layout.unavailableConnections).toBe(0);
      for (const [index, placement] of layout.placements.entries()) {
        const bounds = placement.coreBounds;
        for (const value of [placement.x, placement.y, placement.port.x, placement.port.y, bounds.width, bounds.height]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(layout.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(layout.height);
        for (const other of layout.placements.slice(index + 1)) {
          const b = other.coreBounds;
          const overlap = bounds.x < b.x + b.width && bounds.x + bounds.width > b.x &&
            bounds.y < b.y + b.height && bounds.y + bounds.height > b.y;
          expect(overlap, `${fixture.project} core bays ${index} and ${other.index}`).toBe(false);
        }
      }
      const declared = new Set(flows.flatMap((flow) => flow.steps.map((step) => JSON.stringify([step.from, step.to]))));
      expect(new Set(layout.connections.map((edge) => JSON.stringify([edge.from, edge.to])))).toEqual(declared);
      for (const edge of layout.connections) {
        const curve = dispatchCurve(layout, edge.from, edge.to);
        expect(curve).not.toBeNull();
        if (!curve) throw new Error("Declared edge did not produce a curve");
        expect(pointOnDispatchCurve(curve, 0)).toEqual(layout.byId.get(edge.from)?.port);
        expect(pointOnDispatchCurve(curve, 1)).toEqual(layout.byId.get(edge.to)?.port);
        expect(dispatchCurvePath(curve)).not.toMatch(/NaN|Infinity|undefined/);
      }
    },
  );

  it("preserves repeated handoffs, self loops, returns, and isolated machines", () => {
    const flow = flowFor([["a", "b"], ["b", "a"], ["a", "b"], ["b", "b"]]);
    const layout = layoutDispatchRoom([node("a"), node("b", "agent"), node("isolated", "repo")], [flow]);
    expect(layout.placements).toHaveLength(3);
    expect(layout.connections).toHaveLength(3);
    expect(layout.connections.find((edge) => edge.from === "a" && edge.to === "b")?.occurrences).toHaveLength(2);
    expect(resolveDispatchStep([flow], flow.steps[2])).toBe(flow.steps[2]);
    expect(dispatchCurve(layout, "a", "isolated")).toBeNull();
    expect(dispatchCurve(layout, "b", "b")?.[0]).toEqual(dispatchCurve(layout, "b", "b")?.[3]);
    const returning = dispatchCurve(layout, "b", "a");
    expect(dispatchCurve(layout, "a", "b")).not.toEqual(returning ? [...returning].reverse() : null);
  });

  it("reports unavailable endpoints without fabricating a relationship", () => {
    const flow = flowFor([["a", "missing"]]);
    const layout = layoutDispatchRoom([node("a")], [flow]);
    expect(layout.unavailableConnections).toBe(1);
    expect(layout.connections).toHaveLength(0);
    expect(dispatchCurve(layout, "a", "missing")).toBeNull();
    expect(resolveDispatchStep([flow], { ...flow.steps[0], id: "undeclared" })).toBeNull();
  });

  it("does not expose private roles through mechanism variants or captions", () => {
    const sealed: DispatchNode = {
      id: "private-internal-id", kind: "tool", label: "PRIVATE weather tool",
      resource: "PRIVATE resource", detail: "PRIVATE detail", url: "https://private.invalid",
      restricted: true, private: true,
    };
    const layout = layoutDispatchRoom([sealed], []);
    expect(dispatchMechanism(sealed)).toBe("restricted");
    expect(layout.placements[0].labelLines).toEqual(["Restricted component"]);
    expect(dispatchMechanism({ ...node("public", "tool"), label: "get_weather" })).toBe("weather");
    expect(dispatchMechanism({ ...node("public", "data"), label: "Application Insights" })).toBe("observatory");
  });

  it("handles empty inputs, optional fields, long names and immutable arrays", () => {
    expect(layoutDispatchRoom([], []).placements).toEqual([]);
    expect(layoutDispatchRoom([], []).connections).toEqual([]);
    const nodes = Object.freeze([Object.freeze(node("get_context_" + "very_long_".repeat(20), "tool"))]);
    const layout = layoutDispatchRoom(nodes, Object.freeze([]));
    expect(layout.placements[0].labelLines).toHaveLength(2);
    expect(layout.placements[0].labelLines[1]).toMatch(/…$/);
    expect(wrapDispatchLabel("short")).toEqual(["short"]);
    expect(() => layoutDispatchRoom([node("a"), node("a")], [])).toThrow(/unique/);
  });
});

describe("controlled Dispatch illustration poses", () => {
  it("uses the preparation, travel, and receiver phases supplied by playback", () => {
    expect(dispatchPlaybackPose(0.075, true, false).sender).toBeCloseTo(1);
    expect(dispatchPlaybackPose(0.075, true, false).courierVisible).toBe(false);
    expect(dispatchPlaybackPose(0.15, true, false).travel).toBe(0);
    expect(dispatchPlaybackPose(0.475, true, false).travel).toBeCloseTo(0.5);
    expect(dispatchPlaybackPose(0.8, true, false).travel).toBe(1);
    expect(dispatchPlaybackPose(0.9, true, false).receiver).toBeCloseTo(1);
    expect(dispatchPlaybackPose(0.9, true, false).courierVisible).toBe(false);
  });

  it("leaves reduced motion and reading phases still, with finite geometry", () => {
    for (const [visible, reduced] of [[false, false], [true, true]]) {
      const pose = dispatchPlaybackPose(0.9, visible, reduced);
      expect(pose.sender).toBe(0);
      expect(pose.receiver).toBe(0);
      expect(pose.courierVisible).toBe(false);
    }
    expect(dispatchPlaybackPose(Number.NaN, true, false).courierVisible).toBe(false);
    expect(dispatchPlaybackPose(-10, true, false).progress).toBe(0);
    expect(dispatchPlaybackPose(10, true, false).progress).toBe(1);
  });

  it("keeps a mobile viewpoint cropped, bounded and deterministic", () => {
    const layout = layoutDispatchRoom(kinds.map((kind) => node(kind, kind)), []);
    const view = dispatchFollowView(layout, layout.placements[0].port, 390 / 540);
    expect(view.width).toBeLessThan(500);
    expect(view.height).toBe(620);
    expect(view.x).toBeGreaterThanOrEqual(0);
    expect(view.y).toBeGreaterThanOrEqual(0);
    expect(view.x + view.width).toBeLessThanOrEqual(layout.width);
    expect(view.y + view.height).toBeLessThanOrEqual(layout.height);
    expect(dispatchFollowView(layout, layout.placements[0].port, 390 / 540)).toEqual(view);
  });
});

describe("Dispatch focus and destination continuity", () => {
  it("follows the current destination during reduced-motion playback, not a retained inspection", () => {
    const flow = flowFor([["trigger", "agent"]]);
    const layout = layoutDispatchRoom(kinds.map((kind) => node(kind, kind)), [flow]);
    const focus = dispatchFocusPoint(layout, {
      activeStep: flow.steps[0],
      selectedNodeId: "channel",
      progress: 1,
      motionVisible: true,
      paused: false,
      reducedMotion: true,
    }, null);
    expect(focus).toEqual(layout.byId.get("agent")?.port);
    expect(focus).not.toEqual(layout.byId.get("channel")?.port);
  });

  it("lets an explicit paused inspection take focus while running motion follows the courier", () => {
    const flow = flowFor([["trigger", "agent"]]);
    const layout = layoutDispatchRoom(kinds.map((kind) => node(kind, kind)), [flow]);
    const options = {
      activeStep: flow.steps[0], selectedNodeId: "data", progress: 0.4,
      motionVisible: true, paused: true, reducedMotion: false,
    };
    const courier = { x: 410, y: 300 };
    expect(dispatchFocusPoint(layout, options, courier)).toEqual(layout.byId.get("data")?.port);
    expect(dispatchFocusPoint(layout, { ...options, paused: false }, courier)).toEqual(courier);
  });

  it.each([agentMode, atlas, autoRefine, foundryLab, mindMe, turgo])(
    "identifies each offscreen destination in $project without zooming out the whole room",
    (fixture) => {
      const model = fixtureView(fixture);
      for (const flow of model.flows) {
        const ids = new Set(flow.steps.flatMap((step) => [step.from, step.to]));
        const layout = layoutDispatchRoom(model.nodes.filter((item) => ids.has(item.id)), [flow]);
        for (const step of flow.steps) {
          const source = layout.byId.get(step.from);
          const destination = layout.byId.get(step.to);
          if (!source || !destination) throw new Error("Fixture endpoint is unavailable.");
          const view = dispatchFollowView(layout, source.port, 390 / 540);
          const outside = destination.port.x < view.x || destination.port.x > view.x + view.width ||
            destination.port.y < view.y || destination.port.y > view.y + view.height;
          const cue = dispatchDestinationCue(layout, step.to, view);
          if (outside) {
            expect(cue?.nodeId).toBe(step.to);
            expect(cue?.label).toBe(step.toLabel);
            expect(cue?.offset).toBeGreaterThanOrEqual(0.15);
            expect(cue?.offset).toBeLessThanOrEqual(0.85);
          } else {
            expect(cue).toBeNull();
          }
        }
      }
    },
  );

  it("keeps a restricted destination label generic and rejects invalid view bounds", () => {
    const secret: DispatchNode = { ...node("sealed", "data"), label: "PRIVATE_LABEL", private: true, restricted: true };
    const layout = layoutDispatchRoom([node("start"), secret], [flowFor([["start", "sealed"]])]);
    const cue = dispatchDestinationCue(layout, "sealed", { x: -400, y: 0, width: 100, height: 300 });
    expect(cue?.label).toBe("Restricted component");
    expect(() => dispatchDestinationCue(layout, "sealed", { x: 0, y: 0, width: 0, height: 100 })).toThrow(RangeError);
  });
});
