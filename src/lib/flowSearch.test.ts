import { describe, expect, it } from "vitest";
import type { BlueprintFlow } from "./blueprint";
import { filterFlows } from "./flowSearch";

const flows: BlueprintFlow[] = [
  {
    id: "daily_digest",
    label: "Daily digest",
    trigger: "Morning timer",
    steps: [],
  },
  {
    id: "telegram_chat",
    label: "Telegram chat",
    trigger: "User message",
    steps: [],
  },
];

describe("filterFlows", () => {
  it("filters flows by name in a case-insensitive way", () => {
    expect(filterFlows(flows, ["personal"], "TELEGRAM")).toEqual([flows[1]]);
  });

  it("matches flow ids, triggers, and blueprint tags", () => {
    expect(filterFlows(flows, ["personal"], "daily_")).toEqual([flows[0]]);
    expect(filterFlows(flows, ["personal"], "morning")).toEqual([flows[0]]);
    expect(filterFlows(flows, ["personal"], "personal")).toEqual(flows);
  });

  it("returns all flows for an empty query", () => {
    expect(filterFlows(flows, ["personal"], "  ")).toBe(flows);
  });
});
