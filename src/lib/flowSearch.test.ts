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

  it("trims a query before matching", () => {
    expect(filterFlows(flows, undefined, "  TELEGRAM  ")).toEqual([flows[1]]);
  });

  it("returns no flows when there is no match", () => {
    expect(filterFlows(flows, undefined, "unmatched")).toEqual([]);
  });

  it("handles flows without optional trigger or blueprint tags", () => {
    const flow: BlueprintFlow = { id: "manual", label: "Manual", steps: [] };
    expect(filterFlows([flow], undefined, "manual")).toEqual([flow]);
    expect(filterFlows([flow], undefined, "timer")).toEqual([]);
  });

  it("preserves flow identity and source ordering for stable selection and colors", () => {
    const result = filterFlows(flows, ["PERSONAL"], "person");
    expect(result).toEqual(flows);
    expect(result[0]).toBe(flows[0]);
    expect(result[1]).toBe(flows[1]);
  });
});
