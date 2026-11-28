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
const publicSource = ["--source-repo", "example/sample-agent", "--source-path", "."];
const existingEntry = { file: "other.json", project: "other", source: { repository: "private" } };
const otherBlueprint = {
  version: "1.0", project: "other", agent: "Other", summary: "Another agent.",
  nodes: [{ id: "input", kind: "channel", label: "Input" }, { id: "worker", kind: "agent", label: "Worker" }],
  flows: [{ id: "request", label: "Handle request", steps: [{ from: "input", to: "worker" }] }],
};

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
    const result = run([...args, ...publicSource, "--to-private", "--flow-private"]);
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
    expect(run([...args, ...publicSource]).status).not.toBe(0);
    expect(readFileSync(destination, "utf8")).toBe("original");
  });

  it.each([
    ["invalid project path", ["--project", "../escape"]],
    ["duplicate node IDs", ["--to-id", "input"]],
    ["invalid node kind", ["--to-kind", "invalid"]],
    ["invalid flow ID", ["--flow-id", "Invalid"]],
    ["oversized summary", ["--summary", "a".repeat(281)]],
    ["missing source", ["--source-repo", "", "--source-path", ""]],
    ["invalid source repository", ["--source-repo", "not a repo"]],
    ["private source with a repository name", ["--source-private"]],
  ])("rejects %s without leaving a blueprint", (_description, overrides) => {
    const result = run([...args, ...publicSource, ...overrides]);
    expect(result.status).not.toBe(0);
    expect(existsSync(destination)).toBe(false);
  });

  it("removes the new file when an existing blueprint fails validation", () => {
    writeFileSync(join(directory, "src", "blueprints", "bad.json"), "{}");
    const result = run([...args, ...publicSource]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Validation failed");
    expect(existsSync(destination)).toBe(false);
  });

  describe("with a source manifest", () => {
    const listedOther = `{
  "blueprints": [
    {
      "file": "other.json",
      "project": "other",
      "source": { "repository": "private" }
    }
  ]
}
`;
    let manifestPath: string;

    beforeEach(() => {
      manifestPath = join(directory, "src", "blueprints", "manifest.json");
      writeFileSync(join(directory, "src", "blueprints", "other.json"), JSON.stringify(otherBlueprint));
      writeFileSync(manifestPath, listedOther);
    });

    const manifestText = () => readFileSync(manifestPath, "utf8");

    it.each([["LF", "\n"], ["CRLF", "\r\n"]])(
      "appends only the new entry to a %s manifest so the manifest check passes",
      (_name, eol) => {
        writeFileSync(manifestPath, listedOther.replace(/\n/g, eol));
        const result = run([...args, ...publicSource]);
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain("manifest.json lists all 2 blueprint(s)");
        expect(manifestText()).toBe(`{
  "blueprints": [
    {
      "file": "other.json",
      "project": "other",
      "source": { "repository": "private" }
    },
    {
      "file": "sampleAgent.json",
      "project": "sampleAgent",
      "source": { "repository": "example/sample-agent", "path": "." }
    }
  ]
}
`.replace(/\n/g, eol));
      },
    );

    it("records a private source without its repository name or path", () => {
      const result = run([...args, "--source-private"]);
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(manifestText()).blueprints[1]).toEqual({
        file: "sampleAgent.json", project: "sampleAgent", source: { repository: "private" },
      });
    });

    it("restores the manifest when validation fails", () => {
      writeFileSync(join(directory, "src", "blueprints", "bad.json"), "{}");
      const result = run([...args, ...publicSource]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Validation failed");
      expect(existsSync(destination)).toBe(false);
      expect(manifestText()).toBe(listedOther);
    });

    it.each([
      ["a manifest-level key it would drop", { $schema: "manifest.schema.json", blueprints: [existingEntry] }],
      ["an entry key it would drop", { blueprints: [{ ...existingEntry, notes: "keep me" }] }],
      ["a null entry", { blueprints: [existingEntry, null] }],
      ["an entry without a source", { blueprints: [{ file: "other.json", project: "other" }] }],
      ["the new file already listed", { blueprints: [existingEntry, { ...existingEntry, file: "sampleAgent.json" }] }],
    ])("refuses a manifest with %s and writes nothing", (_description, content) => {
      const before = JSON.stringify(content);
      writeFileSync(manifestPath, before);
      const result = run([...args, ...publicSource]);
      expect(result.status).not.toBe(0);
      expect(existsSync(destination)).toBe(false);
      expect(manifestText()).toBe(before);
    });
  });

  it("reports missing input and help without writing files", () => {
    expect(run([]).stderr).toContain("Missing or empty --project");
    expect(run(["--help"]).stdout).toContain("--source-private");
    expect(existsSync(destination)).toBe(false);
  });
});
