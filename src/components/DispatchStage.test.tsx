import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NodeKind } from "../lib/blueprint";
import type { DispatchFlow, DispatchNode, DispatchStageProps } from "../lib/dispatchTypes";
import { DISPATCH_LABEL_MAX_WIDTH, estimateDispatchLabelWidth } from "../lib/dispatchLayout";
import { DispatchStage } from "./DispatchStage";

const kinds: readonly NodeKind[] = ["channel", "trigger", "compute", "agent", "tool", "data", "secret", "job", "repo", "pwa"];
const nodes: readonly DispatchNode[] = kinds.map((kind) => ({
  id: `internal-${kind}`, kind, label: `Public ${kind}`, private: false, restricted: false,
}));
const flow: DispatchFlow = {
  id: "flow", label: "Declared handoffs", private: false,
  steps: [
    ["internal-trigger", "internal-compute"],
    ["internal-compute", "internal-trigger"],
    ["internal-trigger", "internal-compute"],
  ].map(([from, to], index) => ({
    id: `internal-step-${index}`, flowId: "flow", flowLabel: "Declared handoffs", index,
    from, to, fromLabel: from, toLabel: to, sourceChanged: false,
  })),
};
const base: DispatchStageProps = {
  project: "Example", agent: "Example agent", nodes, flows: [flow], activeStep: flow.steps[0],
  progress: 0, motionVisible: false, paused: false, selectedNodeId: null,
  viewMode: "overview", reducedMotion: false, onSelectNode: () => undefined,
};
const render = (props: Partial<DispatchStageProps> = {}) =>
  renderToStaticMarkup(<DispatchStage {...base} {...props} />);

describe("DispatchStage static and server rendering", () => {
  it("renders an original illustrated room and all ten inspectable machine kinds", () => {
    const html = render();
    expect(html).toContain('data-testid="dispatch-stage"');
    expect(html.match(/data-testid="dispatch-machine"/g)).toHaveLength(10);
    expect(html.match(/role="button"/g)).toHaveLength(10);
    expect(html.match(/tabindex="0"/g)).toHaveLength(10);
    for (const kind of kinds) expect(html).toContain(`data-kind="${kind}"`);
    expect(html).toContain("DISPATCH LAB");
    expect(html).toContain("Only arrows represent declared handoffs");
    expect(html).toContain("not live execution");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("internal-compute");
    expect(html).not.toContain("internal-step");
  });

  it("keeps multiple agents separate and handles long labels and absent optional fields", () => {
    const name = "A_long_component_name_" + "word_".repeat(30);
    const multiple: DispatchNode[] = [
      { id: "one", kind: "agent", label: "First companion", private: false, restricted: false },
      { id: "two", kind: "agent", label: "Second companion", private: false, restricted: false },
      { id: "three", kind: "pwa", label: name, private: false, restricted: false },
    ];
    const html = render({ nodes: multiple, flows: [], activeStep: null });
    expect(html.match(/data-mechanism="agent"/g)).toHaveLength(2);
    expect(html).toContain("First companion");
    expect(html).toContain("Second companion");
    expect(html).toContain(name);
    expect(html).toContain("…");
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("never serializes restricted labels, original kinds, identifiers or resources", () => {
    const sealed: DispatchNode = {
      id: "PRIVATE_ID_SENTINEL", kind: "repo", label: "PRIVATE_LABEL_SENTINEL",
      detail: "PRIVATE_DETAIL_SENTINEL", resource: "PRIVATE_RESOURCE_SENTINEL",
      url: "https://example.invalid/PRIVATE_URL_SENTINEL", private: true, restricted: true,
    };
    const html = render({
      nodes: [sealed], flows: [], activeStep: null, selectedNodeId: sealed.id,
      focusRequest: { nodeId: sealed.id, requestId: 1 },
      onFocusNode: () => { throw new Error("Server rendering must not move focus."); },
    });
    expect(html).toContain("Restricted component");
    expect(html).toContain("Sealed private component");
    expect(html).toContain('data-kind="restricted"');
    expect(html).not.toContain('data-kind="repo"');
    expect(html).not.toContain("PRIVATE_");
    expect(html).not.toContain("example.invalid");
    const publicNode = { ...sealed, id: "public", label: "Public repo", private: false, restricted: false };
    expect(render({ nodes: [publicNode], flows: [], activeStep: null })).not.toContain("PRIVATE_");
  });

  it("bounds wide captions while keeping the full title and accessible label", () => {
    const label = "W".repeat(50);
    const html = render({
      nodes: [{ ...nodes[0], label }, { ...nodes[1], label }],
      flows: [], activeStep: null,
    });
    expect(html.match(new RegExp(`<title>${label}</title>`, "g"))).toHaveLength(2);
    expect(html.match(new RegExp(`aria-label="${label}\\.`, "g"))).toHaveLength(2);
    const lines = [...html.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((match) => match[1]);
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(estimateDispatchLabelWidth(line)).toBeLessThanOrEqual(DISPATCH_LABEL_MAX_WIDTH);
    expect(html).not.toContain("textLength=");
    expect(html).not.toContain("lengthAdjust=");
  });

  it("keeps offscreen mechanisms in the follow-view tab order without serializing focus requests", () => {
    const html = render({
      viewMode: "follow",
      focusRequest: { nodeId: nodes[9].id, requestId: 4 },
      onFocusNode: () => { throw new Error("Focus callbacks run only after an actual focus event."); },
    });
    expect(html.match(/tabindex="0"/g)).toHaveLength(10);
    expect(html).not.toContain("requestId");
    expect(html).not.toContain(nodes[9].id);
    expect(html).toContain('data-step-index="0"');
  });

  it("escapes supplied public text instead of injecting SVG or HTML", () => {
    const unsafe = { ...nodes[0], label: '<script>alert("x")</script>' };
    const html = render({ nodes: [unsafe], flows: [], activeStep: null });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses unique SVG definitions and references for each simultaneous stage", () => {
    const html = renderToStaticMarkup(<><DispatchStage {...base} /><DispatchStage {...base} /></>);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reference of html.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(reference[1]);
  });

  it("retains repeated step identity without inventing extra physical edges", () => {
    const html = render({ activeStep: flow.steps[2], motionVisible: true, progress: 0.475 });
    expect(html).toContain('data-step-index="2"');
    expect(html.match(/data-testid="dispatch-connection"/g)).toHaveLength(2);
    expect(html).toContain('data-testid="dispatch-courier"');
    expect(html).toContain('data-testid="dispatch-active-path"');
  });

  it("derives different carrier poses from supplied progress, and freezes at a paused pose", () => {
    const start = render({ progress: 0.25, motionVisible: true });
    const middle = render({ progress: 0.475, motionVisible: true });
    const paused = render({ progress: 0.475, motionVisible: true, paused: true });
    const carrier = (html: string) => html.match(/data-testid="dispatch-courier" transform="([^"]+)"/)?.[1];
    expect(carrier(start)).toBeDefined();
    expect(carrier(start)).not.toBe(carrier(middle));
    expect(carrier(paused)).toBe(carrier(middle));
    expect(paused).toContain('data-paused="true"');
    expect(render({ progress: 0.9, motionVisible: true })).not.toContain('data-testid="dispatch-courier"');
  });

  it("keeps the relationship visible without animation in reduced motion and reading phases", () => {
    for (const props of [
      { reducedMotion: true, motionVisible: true },
      { reducedMotion: false, motionVisible: false },
    ]) {
      const html = render({ ...props, progress: 0.475 });
      expect(html).not.toContain('data-testid="dispatch-courier"');
      expect(html).toContain('data-testid="dispatch-active-path"');
      expect(html).toContain("Public trigger");
      expect(html).toContain("Public compute");
    }
  });

  it("shows explicit empty, unavailable-handoff and invalid-progress states", () => {
    const empty = render({ nodes: [], flows: [], activeStep: null });
    expect(empty).toContain("No components are available");
    expect(empty).not.toContain('data-testid="dispatch-machine"');
    const unavailable = render({ activeStep: { ...flow.steps[0], id: "not-in-visible-flow" }, motionVisible: true });
    expect(unavailable).toContain("unavailable in this view");
    expect(unavailable).not.toContain('data-testid="dispatch-active-path"');
    expect(unavailable).not.toContain('data-testid="dispatch-courier"');
    const invalid = render({ progress: Number.NaN, motionVisible: true });
    expect(invalid).toContain("playback position is unavailable");
    expect(invalid).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("renders a follow viewpoint on the server without using browser globals", () => {
    const follow = render({ viewMode: "follow", motionVisible: true, progress: 0.4 });
    const overview = render();
    const viewBox = (html: string) => html.match(/class="dispatch-stage__scene" viewBox="([^"]+)"/)?.[1];
    expect(viewBox(follow)).toBeDefined();
    expect(viewBox(follow)).not.toBe(viewBox(overview));
  });
});
