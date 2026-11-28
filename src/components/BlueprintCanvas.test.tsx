import { getViewportForBounds } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import mindMe from "../blueprints/mindMe.json";
import type { AgentBlueprint } from "../lib/blueprint";
import { FIT_VIEW_OPTIONS } from "../lib/layout";
import { BlueprintCanvas } from "./BlueprintCanvas";

describe("BlueprintCanvas", () => {
  it("leaves about 7.6% of the viewport free on each side when it fits the graph", () => {
    const width = 1400;
    const { x } = getViewportForBounds(
      { x: 0, y: 0, width: 1000, height: 100 },
      width,
      550,
      0.1,
      1.5,
      FIT_VIEW_OPTIONS.padding,
    );
    expect(x).toBeGreaterThanOrEqual(Math.floor(width * 0.07));
    expect(x).toBeLessThanOrEqual(Math.ceil(width * 0.08));
  });

  it("stays in the light theme whatever the system color scheme is", () => {
    const html = renderToStaticMarkup(
      <BlueprintCanvas blueprint={mindMe as AgentBlueprint} flowId="__all__" redactPrivate={false} />,
    );
    expect(html).toContain('class="react-flow light"');
  });
});
