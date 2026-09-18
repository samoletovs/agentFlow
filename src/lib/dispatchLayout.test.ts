import { describe, expect, it, vi } from "vitest";
import agentMode from "../blueprints/agentMode.json";
import atlas from "../blueprints/atlas.json";
import autoRefine from "../blueprints/autoRefine.json";
import foundryLab from "../blueprints/foundryLab.json";
import mindMe from "../blueprints/mindMe.json";
import turgo from "../blueprints/turgo.json";
import type { NodeKind } from "./blueprint";
import type { DispatchFlow, DispatchNode, DispatchStep } from "./dispatchTypes";
import {
  createDispatchLabelMeasurer,
  DISPATCH_LABEL_FONT,
  DISPATCH_LABEL_MAX_WIDTH,
  dispatchCurve,
  dispatchCurvePath,
  dispatchDestinationCue,
  dispatchFocusPoint,
  dispatchFollowView,
  dispatchMechanism,
  dispatchPlaybackPose,
  estimateDispatchLabelWidth,
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

describe("width-bounded Dispatch labels", () => {
  const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
  const measuredWidth = (text: string) => Array.from(graphemes.segment(text)).reduce(
    (width, { segment }) => width + (segment === "W" ? 20.16 : segment === "M" ? 19.12 : 12),
    0,
  );

  it.each([
    ["wide W", "W".repeat(50), measuredWidth],
    ["wide M", "M".repeat(50), measuredWidth],
    ["monospace", "component0123456789".repeat(3), (text: string) => Array.from(text).length * 12],
    ["Unicode", "\u6a5f\u5668".repeat(25), (text: string) => Array.from(text).length * 20],
    ["underscores", "get_WWWW_context_".repeat(3), measuredWidth],
  ])("fits %s labels without shrinking type or changing the full name", (_name, label, measure) => {
    const layout = layoutDispatchRoom([
      { ...node("one"), label },
      { ...node("two"), label },
    ], [], measure);
    for (const placement of layout.placements) {
      expect(placement.node.label).toBe(label);
      expect(placement.labelLines).toHaveLength(2);
      expect(placement.labelLines[1]).toMatch(/…$/);
      for (const line of placement.labelLines) {
        expect(measure(line)).toBeLessThanOrEqual(DISPATCH_LABEL_MAX_WIDTH);
        expect(placement.x - measure(line) / 2).toBeGreaterThanOrEqual(placement.coreBounds.x);
        expect(placement.x + measure(line) / 2).toBeLessThanOrEqual(placement.coreBounds.x + placement.coreBounds.width);
      }
    }
    const [a, b] = layout.placements;
    const right = a.x + Math.max(...a.labelLines.map(measure)) / 2;
    const left = b.x - Math.max(...b.labelLines.map(measure)) / 2;
    expect(left - right).toBeGreaterThan(5);
  });

  it.each(["e\u0301", "\u{1f469}\u200d\u{1f4bb}"])("never splits a grapheme in %s", (unit) => {
    const measure = (text: string) => Array.from(graphemes.segment(text)).length * 20;
    const lines = wrapDispatchLabel(unit.repeat(40), 25, measure);
    for (const line of lines) {
      expect(measure(line)).toBeLessThanOrEqual(DISPATCH_LABEL_MAX_WIDTH);
      for (const { segment } of graphemes.segment(line)) expect([unit, "…"]).toContain(segment);
    }
  });

  it("prefers identifier boundaries and gives deterministic server fallback widths", () => {
    expect(wrapDispatchLabel("get_context_from_this_component", 25, measuredWidth)[0]).toBe("get_context_from_");
    expect(createDispatchLabelMeasurer()).toBe(estimateDispatchLabelWidth);
    for (const label of ["W".repeat(50), "M".repeat(50), "\u6a5f\u5668".repeat(25)]) {
      const lines = wrapDispatchLabel(label);
      expect(lines).toEqual(wrapDispatchLabel(label));
      for (const line of lines) expect(estimateDispatchLabelWidth(line)).toBeLessThanOrEqual(DISPATCH_LABEL_MAX_WIDTH);
    }
  });

  it("uses one local canvas and bounded text measurements, including glyph overhang", () => {
    const measureText = vi.fn((text: string) => ({
      width: measuredWidth(text),
      actualBoundingBoxLeft: 2,
      actualBoundingBoxRight: measuredWidth(text) + 2,
    }));
    const context = { font: "", measureText };
    const getContext = vi.fn(() => context);
    const createElement = vi.fn(() => ({ getContext }));
    vi.stubGlobal("document", { createElement });
    try {
      const measure = createDispatchLabelMeasurer();
      expect(context.font).toBe(DISPATCH_LABEL_FONT);
      const layout = layoutDispatchRoom([{ ...node("wide"), label: "W".repeat(50) }], [], measure);
      expect(createElement.mock.calls).toEqual([["canvas"]]);
      expect(getContext.mock.calls).toEqual([["2d"]]);
      expect(measureText.mock.calls.length).toBeLessThanOrEqual(15);
      for (const line of layout.placements[0].labelLines) {
        expect(measuredWidth(line) + 4).toBeLessThanOrEqual(DISPATCH_LABEL_MAX_WIDTH);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the deterministic fallback if local canvas measurement is unavailable", () => {
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
    try {
      expect(createDispatchLabelMeasurer()).toBe(estimateDispatchLabelWidth);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([agentMode, atlas, autoRefine, foundryLab, mindMe, turgo])(
    "keeps public and full-view $project labels inside their bays",
    (fixture) => {
      const model = fixtureView(fixture);
      for (const redact of [false, true]) {
        const nodes = model.nodes.map((node, index) => redact
          ? node
          : { ...node, label: fixture.nodes[index].label, restricted: false });
        const layout = layoutDispatchRoom(nodes, model.flows, measuredWidth);
        for (const placement of layout.placements) {
          expect(placement.labelLines.length).toBeLessThanOrEqual(2);
          for (const line of placement.labelLines) expect(measuredWidth(line)).toBeLessThanOrEqual(DISPATCH_LABEL_MAX_WIDTH);
        }
      }
    },
  );
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
  it.each([agentMode, atlas, autoRefine, foundryLab, mindMe, turgo])(
    "frames every keyboard-focused $project mechanism and caption at narrow widths",
    (fixture) => {
      const model = fixtureView(fixture);
      const layout = layoutDispatchRoom(model.nodes, model.flows);
      const options = {
        activeStep: model.flows[0].steps[0], selectedNodeId: model.nodes[0].id,
        progress: 0.4, motionVisible: true, paused: false, reducedMotion: false,
      };
      const courier = { x: 410, y: 300 };
      for (const reducedMotion of [false, true]) {
        for (const placement of layout.placements) {
          const focus = dispatchFocusPoint(layout, { ...options, reducedMotion }, courier, placement.node.id);
          expect(focus).toEqual({ x: placement.x, y: placement.y + 24 });
          for (const width of [320, 390]) {
            const view = dispatchFollowView(layout, focus, width / 540);
            expect(placement.x - 128).toBeGreaterThanOrEqual(view.x);
            expect(placement.x + 128).toBeLessThanOrEqual(view.x + view.width);
            expect(placement.y - 131).toBeGreaterThanOrEqual(view.y);
            expect(placement.y + 178).toBeLessThanOrEqual(view.y + view.height);
          }
        }
      }
      expect(options.activeStep).toBe(model.flows[0].steps[0]);
      expect(dispatchFocusPoint(layout, options, courier, null)).toEqual(courier);
      expect(dispatchFocusPoint(layout, options, courier, "removed")).toEqual(courier);
    },
  );

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
