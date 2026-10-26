import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../src/lib/agent-blueprint.v1.schema.json";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const root = fileURLToPath(new URL("../", import.meta.url));
const runner = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const validator = join(root, "scripts", "validate-blueprints.ts");
const fixture = {
  version: "1.0",
  project: "sampleAgent",
  agent: "Sample agent",
  summary: "Synthetic validation fixture.",
  nodes: [
    { id: "input", kind: "channel", label: "Input" },
    { id: "handler", kind: "compute", label: "Handler" },
  ],
  flows: [{ id: "message", label: "Message", steps: [{ from: "input", to: "handler" }] }],
};

describe("blueprint schema", () => {
  function validFixture(): Record<string, unknown> {
    return structuredClone(fixture);
  }

  it("accepts supported optional fields", () => {
    const data = validFixture();
    data.tags = ["sample"];
    data.stack = ["typescript"];
    data.telemetry = { appInsights: true, tracerName: "sample-agent" };
    (data.nodes as Record<string, unknown>[])[0] = {
      id: "input",
      kind: "channel",
      label: "Input",
      detail: "Receives requests",
      resource: "public-resource",
      private: false,
      url: "https://example.invalid/input",
    };
    (data.flows as Record<string, unknown>[])[0] = {
      id: "message",
      label: "Message",
      trigger: "User message",
      private: false,
      steps: [{ from: "input", to: "handler", label: "Request" }],
    };

    expect(validateSchema(data)).toBe(true);
  });

  it.each(["version", "project", "agent", "summary", "nodes", "flows"] as const)(
    "rejects a missing required top-level field: %s",
    (field) => {
      const data = validFixture();
      delete data[field];
      expect(validateSchema(data)).toBe(false);
    },
  );

  it.each([
    ["version", "2.0"],
    ["project", "Invalid Project"],
    ["agent", 42],
    ["summary", "s".repeat(281)],
    ["tags", "sample"],
    ["tags", [42]],
    ["stack", [42]],
    ["telemetry", "enabled"],
    ["nodes", "input"],
    ["nodes", []],
    ["flows", "message"],
    ["flows", []],
  ])("rejects invalid top-level field %s", (field, value) => {
    const data = validFixture();
    data[field] = value;
    expect(validateSchema(data)).toBe(false);
  });

  it.each([
    { appInsights: "yes" },
    { tracerName: 42 },
  ])("rejects invalid telemetry field types", (telemetry) => {
    const data = validFixture();
    data.telemetry = telemetry;
    expect(validateSchema(data)).toBe(false);
  });

  it("rejects unknown top-level and telemetry properties", () => {
    const data = validFixture();
    data.unknown = true;
    data.telemetry = { unknown: true };
    expect(validateSchema(data)).toBe(false);
  });

  it.each([
    ["missing id", { kind: "channel", label: "Input" }],
    ["missing kind", { id: "input", label: "Input" }],
    ["missing label", { id: "input", kind: "channel" }],
    ["invalid id", { id: "Invalid-ID", kind: "channel", label: "Input" }],
    ["invalid kind", { id: "input", kind: "unknown", label: "Input" }],
    ["invalid label", { id: "input", kind: "channel", label: 42 }],
    ["long label", { id: "input", kind: "channel", label: "l".repeat(61) }],
    ["invalid detail", { id: "input", kind: "channel", label: "Input", detail: 42 }],
    ["long detail", { id: "input", kind: "channel", label: "Input", detail: "d".repeat(201) }],
    ["invalid resource", { id: "input", kind: "channel", label: "Input", resource: 42 }],
    ["invalid private flag", { id: "input", kind: "channel", label: "Input", private: "yes" }],
    ["invalid URL", { id: "input", kind: "channel", label: "Input", url: "not a URI" }],
    ["extra property", { id: "input", kind: "channel", label: "Input", extra: true }],
  ])("rejects a node with %s", (_description, node) => {
    const data = validFixture();
    (data.nodes as unknown[])[0] = node;
    expect(validateSchema(data)).toBe(false);
  });

  it.each([
    ["missing id", { label: "Message", steps: [{ from: "input", to: "handler" }] }],
    ["missing label", { id: "message", steps: [{ from: "input", to: "handler" }] }],
    ["missing steps", { id: "message", label: "Message" }],
    ["invalid id", { id: "Invalid-ID", label: "Message", steps: [{ from: "input", to: "handler" }] }],
    ["invalid label", { id: "message", label: 42, steps: [{ from: "input", to: "handler" }] }],
    ["long label", { id: "message", label: "l".repeat(81), steps: [{ from: "input", to: "handler" }] }],
    ["invalid trigger", { id: "message", label: "Message", trigger: 42, steps: [{ from: "input", to: "handler" }] }],
    ["invalid private flag", { id: "message", label: "Message", private: "yes", steps: [{ from: "input", to: "handler" }] }],
    ["invalid steps", { id: "message", label: "Message", steps: "input" }],
    ["empty steps", { id: "message", label: "Message", steps: [] }],
    ["extra property", { id: "message", label: "Message", steps: [{ from: "input", to: "handler" }], extra: true }],
  ])("rejects a flow with %s", (_description, flow) => {
    const data = validFixture();
    (data.flows as unknown[])[0] = flow;
    expect(validateSchema(data)).toBe(false);
  });

  it.each([
    ["missing from", { to: "handler" }],
    ["missing to", { from: "input" }],
    ["invalid from", { from: 42, to: "handler" }],
    ["invalid to", { from: "input", to: 42 }],
    ["invalid label", { from: "input", to: "handler", label: 42 }],
    ["long label", { from: "input", to: "handler", label: "l".repeat(61) }],
    ["extra property", { from: "input", to: "handler", extra: true }],
  ])("rejects a flow step with %s", (_description, step) => {
    const data = validFixture();
    (data.flows as { steps: unknown[] }[])[0].steps[0] = step;
    expect(validateSchema(data)).toBe(false);
  });
});

function validate(cwd: string) {
  const result = spawnSync(process.execPath, [runner, validator], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  return result;
}

describe("blueprint validation gate", { timeout: 15_000 }, () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "agentflow-blueprint-test-"));
    mkdirSync(join(directory, "src", "lib"), { recursive: true });
    mkdirSync(join(directory, "src", "blueprints"));
    copyFileSync(
      join(root, "src", "lib", "agent-blueprint.v1.schema.json"),
      join(directory, "src", "lib", "agent-blueprint.v1.schema.json"),
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function writeFixture(data: typeof fixture) {
    writeFileSync(join(directory, "src", "blueprints", "sample.json"), JSON.stringify(data));
  }

  it("validates every shipped blueprint", () => {
    const result = validate(root);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/[1-9]\d* blueprint\(s\) validated/);
  });

  it("accepts a schema-valid blueprint with resolvable flow steps", () => {
    writeFixture(fixture);
    expect(validate(directory).status).toBe(0);
  });

  it("rejects an unsupported schema version", () => {
    writeFixture({ ...fixture, version: "2.0" });
    const result = validate(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/version");
  });

  it.each(["from", "to"] as const)("rejects a flow whose %s node does not exist", (endpoint) => {
    const data = structuredClone(fixture);
    data.flows[0].steps[0][endpoint] = "missing";
    writeFixture(data);
    const result = validate(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`step.${endpoint}='missing' has no matching node`);
  });

  it("rejects an empty blueprint directory instead of passing an empty check", () => {
    const result = validate(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("No blueprint files found.");
  });
});
