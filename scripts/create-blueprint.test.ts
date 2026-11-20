import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const runner = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const generator = join(root, "scripts", "create-blueprint.ts");
const args = [
  "--project", "sampleAgent", "--agent", "Sample agent", "--summary", "A sample agent.",
  "--from-id", "input", "--from-kind", "channel", "--from-label", "Input",
  "--to-id", "worker", "--to-kind", "agent", "--to-label", "Worker",
  "--flow-id", "request", "--flow-label", "Handle request",
];

describe("blueprint starter", { timeout: 15_000 }, () => {
  let directory: string;
  let destination: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "agentflow-starter-test-"));
    mkdirSync(join(directory, "src", "lib"), { recursive: true });
    mkdirSync(join(directory, "src", "blueprints"));
    copyFileSync(
      join(root, "src", "lib", "agent-blueprint.v1.schema.json"),
      join(directory, "src", "lib", "agent-blueprint.v1.schema.json"),
    );
    destination = join(directory, "src", "blueprints", "sampleAgent.json");
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function run(arguments_: string[]) {
    const result = spawnSync(process.execPath, [runner, generator, ...arguments_], {
      cwd: directory, encoding: "utf8", timeout: 10_000,
    });
    if (result.error) throw result.error;
    return result;
  }

  it("creates and validates a connected blueprint with the supplied details", () => {
    const result = run([...args, "--to-private", "--flow-private"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("1 blueprint(s) validated");
    expect(JSON.parse(readFileSync(destination, "utf8"))).toEqual({
      version: "1.0", project: "sampleAgent", agent: "Sample agent", summary: "A sample agent.",
      nodes: [
        { id: "input", kind: "channel", label: "Input" },
        { id: "worker", kind: "agent", label: "Worker", private: true },
      ],
      flows: [{ id: "request", label: "Handle request", private: true, steps: [{ from: "input", to: "worker" }] }],
    });
  });

  it("does not overwrite an existing blueprint", () => {
    writeFileSync(destination, "original");
    expect(run(args).status).not.toBe(0);
    expect(readFileSync(destination, "utf8")).toBe("original");
  });

  it.each([
    ["invalid project path", ["--project", "../escape"]],
    ["duplicate node IDs", ["--to-id", "input"]],
    ["invalid node kind", ["--to-kind", "invalid"]],
    ["invalid flow ID", ["--flow-id", "Invalid"]],
    ["oversized summary", ["--summary", "a".repeat(281)]],
  ])("rejects %s without leaving a blueprint", (_description, overrides) => {
    const result = run([...args, ...overrides]);
    expect(result.status).not.toBe(0);
    expect(existsSync(destination)).toBe(false);
  });

  it("removes the new file when an existing blueprint fails validation", () => {
    writeFileSync(join(directory, "src", "blueprints", "bad.json"), "{}");
    const result = run(args);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Validation failed");
    expect(existsSync(destination)).toBe(false);
  });

  it("reports missing input and help without writing files", () => {
    expect(run([]).stderr).toContain("Missing or empty --project");
    expect(run(["--help"]).stdout).toContain("--from-id");
    expect(existsSync(destination)).toBe(false);
  });
});
