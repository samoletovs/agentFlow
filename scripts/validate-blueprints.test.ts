import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

function validate(cwd: string) {
  const result = spawnSync(process.execPath, [runner, validator], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  return result;
}

describe("blueprint validation gate", () => {
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
