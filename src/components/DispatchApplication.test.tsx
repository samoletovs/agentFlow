import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AgentBlueprint } from "../lib/blueprint";
import { DispatchApplication } from "./DispatchApplication";
import { DispatchLab } from "./DispatchLab";
import { DispatchStage } from "./DispatchStage";
import { createDispatchModel } from "../lib/dispatchModel";
import App from "../App";

const blueprint: AgentBlueprint = {
  version: "1.0",
  project: "sampleAgent",
  agent: "Sample agent",
  summary: "An illustrative test blueprint.",
  tags: ["sample"],
  nodes: [
    { id: "start", kind: "trigger", label: "Start" },
    { id: "worker", kind: "compute", label: "Worker" },
    {
      id: "sealed",
      kind: "data",
      label: "PRIVATE_LABEL_SENTINEL",
      detail: "PRIVATE_DETAIL_SENTINEL",
      resource: "PRIVATE_RESOURCE_SENTINEL",
      url: "https://example.com/PRIVATE_URL_SENTINEL",
      private: true,
    },
  ],
  flows: [
    {
      id: "public",
      label: "Public handoffs",
      steps: [
        { from: "start", to: "worker", label: "dispatch" },
        { from: "worker", to: "sealed", label: "read declared context" },
        { from: "sealed", to: "worker", label: "return context" },
      ],
    },
    {
      id: "hidden",
      label: "PRIVATE_FLOW_SENTINEL",
      trigger: "PRIVATE_TRIGGER_SENTINEL",
      private: true,
      steps: [{ from: "worker", to: "sealed" }],
    },
  ],
};

describe("Dispatch Lab application", () => {
  it("wires the illustrated experience into the real application entry point", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('data-testid="dispatch-application"');
    expect(html).toContain('data-testid="dispatch-stage"');
    expect(html).toContain("Play full flow");
  });

  it("renders the selected illustrated experience with full-flow controls", () => {
    const html = renderToStaticMarkup(
      <DispatchApplication
        blueprints={[blueprint]}
        allowlist={[]}
        nodeKinds={[{ kind: "compute", label: "Compute" }]}
      />,
    );
    expect(html).toContain('data-testid="dispatch-stage"');
    expect(html).toContain('data-testid="flow-play"');
    expect(html).toContain("Play full flow");
    expect(html).toContain("Public handoffs");
    expect(html).toContain("All flows / overview");
    expect(html).toContain("Diagram");
    expect(html).toContain("not live execution");
    expect(html).not.toContain('class="dispatch-stage__caption"');
    expect(html).toContain('class="handoff-narration"');
  });

  it("starts fail-closed and omits every restricted field from public markup", () => {
    const html = renderToStaticMarkup(
      <DispatchApplication blueprints={[blueprint]} allowlist={["viewer@example.com"]} nodeKinds={[]} />,
    );
    expect(html).toContain('data-access="public"');
    expect(html).toContain("Restricted component");
    expect(html).not.toContain("PRIVATE_LABEL_SENTINEL");
    expect(html).not.toContain("PRIVATE_DETAIL_SENTINEL");
    expect(html).not.toContain("PRIVATE_RESOURCE_SENTINEL");
    expect(html).not.toContain("PRIVATE_URL_SENTINEL");
    expect(html).not.toContain("PRIVATE_FLOW_SENTINEL");
    expect(html).not.toContain("PRIVATE_TRIGGER_SENTINEL");
  });

  it("preserves private labels and flow choices when full-view access is supplied", () => {
    const html = renderToStaticMarkup(<DispatchLab blueprint={blueprint} redactPrivate={false} />);
    expect(html).toContain("PRIVATE_LABEL_SENTINEL");
    expect(html).toContain("PRIVATE_FLOW_SENTINEL");
  });

  it("retains every declared handoff occurrence in the readable outline", () => {
    const html = renderToStaticMarkup(<DispatchLab blueprint={blueprint} redactPrivate />);
    expect(html).toContain("Read the handoff outline · 3 steps");
    expect(html).toContain("read declared context");
    expect(html).toContain("return context");
  });

  it("shows an explicit empty configuration error", () => {
    const html = renderToStaticMarkup(
      <DispatchApplication blueprints={[]} allowlist={[]} nodeKinds={[]} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("No agent blueprint is available");
  });

  it("retains stage errors when the app owns the contextual caption", () => {
    const model = createDispatchModel(blueprint, true);
    const html = renderToStaticMarkup(
      <DispatchStage
        project={model.project}
        agent={model.agent}
        nodes={model.nodes}
        flows={model.flows}
        activeStep={model.flows[0].steps[0]}
        progress={Number.NaN}
        motionVisible
        paused={false}
        selectedNodeId={null}
        viewMode="overview"
        reducedMotion={false}
        showContextCaption={false}
        onSelectNode={() => {}}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("The playback position is unavailable");
  });
});
