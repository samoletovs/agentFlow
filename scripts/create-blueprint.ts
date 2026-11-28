import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const options = {
  project: { type: "string" },
  agent: { type: "string" },
  summary: { type: "string" },
  "from-id": { type: "string" },
  "from-kind": { type: "string" },
  "from-label": { type: "string" },
  "to-id": { type: "string" },
  "to-kind": { type: "string" },
  "to-label": { type: "string" },
  "flow-id": { type: "string" },
  "flow-label": { type: "string" },
  "from-private": { type: "boolean" },
  "to-private": { type: "boolean" },
  "flow-private": { type: "boolean" },
  "source-repo": { type: "string" },
  "source-path": { type: "string" },
  "source-private": { type: "boolean" },
  help: { type: "boolean" },
} as const;

const usage = `Usage: npm run create-blueprint -- --project NAME --agent NAME --summary TEXT \\
  --from-id ID --from-kind KIND --from-label LABEL --to-id ID --to-kind KIND --to-label LABEL \\
  --flow-id ID --flow-label LABEL [--from-private] [--to-private] [--flow-private] \\
  (--source-repo OWNER/REPO --source-path PATH | --source-private)

Project names must match ^[a-z][a-zA-Z]+$. Node and flow IDs use lowercase letters,
digits, and underscores. Kinds: channel, trigger, compute, tool, data, secret,
agent, job, repo, pwa. Mark nodes or flows that touch personal data as private.

The source is recorded in src/blueprints/manifest.json. For a public repository
give --source-repo and --source-path ("." for the root). For a private one give
only --source-private, which records no repository name or path.`;

type Source = { repository: string; path?: string };
type ManifestEntry = { file: string; project: string; source: Source };

function readSource(values: { "source-repo"?: string; "source-path"?: string; "source-private"?: boolean }): Source {
  const repository = values["source-repo"]?.trim();
  const path = values["source-path"]?.trim();
  if (values["source-private"]) {
    if (repository || path) {
      throw new Error("Use --source-private on its own; do not record a private repository's name or path.");
    }
    return { repository: "private" };
  }
  if (!repository || !path) {
    throw new Error(`Give --source-repo and --source-path, or --source-private.\n${usage}`);
  }
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repository)) {
    throw new Error("Invalid --source-repo; expected OWNER/REPO.");
  }
  return { repository, path };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

// The manifest is rewritten from its entries, so anything this cannot represent
// would be lost. Refuse instead, before any file is written.
function readManifestEntries(text: string, manifestPath: string): ManifestEntry[] {
  const unsupported = (detail: string) =>
    new Error(`${manifestPath} ${detail}; the generator would not preserve it. Fix it or add the entry by hand.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${manifestPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
  if (!isPlainObject(parsed) || !hasOnlyKeys(parsed, ["blueprints"]) || !Array.isArray(parsed.blueprints)) {
    throw unsupported('must be an object with only a "blueprints" array');
  }
  return parsed.blueprints.map((entry, index) => {
    if (
      !isPlainObject(entry) ||
      !hasOnlyKeys(entry, ["file", "project", "source"]) ||
      typeof entry.file !== "string" ||
      typeof entry.project !== "string" ||
      !isPlainObject(entry.source) ||
      !Object.values(entry.source).every((item) => typeof item === "string")
    ) {
      throw unsupported(`blueprints[${index}] is not exactly {file, project, source}`);
    }
    return entry as ManifestEntry;
  });
}

// Keeps the manifest's one-entry-per-block layout, so a new entry is a small diff.
function formatManifest(entries: ManifestEntry[], eol: string): string {
  const source = (value: Source) =>
    `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${JSON.stringify(item)}`).join(", ")} }`;
  const blocks = entries.map((entry) => [
    "    {",
    `      "file": ${JSON.stringify(entry.file)},`,
    `      "project": ${JSON.stringify(entry.project)},`,
    `      "source": ${source(entry.source)}`,
    "    }",
  ].join(eol));
  return ["{", '  "blueprints": [', blocks.join(`,${eol}`), "  ]", "}", ""].join(eol);
}

try {
  const { values } = parseArgs({ options });
  if (values.help) {
    console.log(usage);
  } else {
    const required = [
      "project", "agent", "summary", "from-id", "from-kind", "from-label",
      "to-id", "to-kind", "to-label", "flow-id", "flow-label",
    ] as const;
    for (const key of required) {
      if (!values[key]?.trim()) throw new Error(`Missing or empty --${key}.\n${usage}`);
    }

    const project = values.project!;
    if (!/^[a-z][a-zA-Z]+$/.test(project)) {
      throw new Error("Invalid project name; expected ^[a-z][a-zA-Z]+$.");
    }
    if (values["from-id"] === values["to-id"]) {
      throw new Error("The two node IDs must be different.");
    }
    const source = readSource(values);

    const blueprint = {
      version: "1.0",
      project,
      agent: values.agent,
      summary: values.summary,
      nodes: [
        { id: values["from-id"], kind: values["from-kind"], label: values["from-label"], ...(values["from-private"] && { private: true }) },
        { id: values["to-id"], kind: values["to-kind"], label: values["to-label"], ...(values["to-private"] && { private: true }) },
      ],
      flows: [{
        id: values["flow-id"],
        label: values["flow-label"],
        ...(values["flow-private"] && { private: true }),
        steps: [{ from: values["from-id"], to: values["to-id"] }],
      }],
    };
    const file = `${project}.json`;
    const destination = join("src", "blueprints", file);
    const manifestPath = join("src", "blueprints", "manifest.json");
    const originalManifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : undefined;
    let nextManifest: string | undefined;
    if (originalManifest !== undefined) {
      const entries = readManifestEntries(originalManifest, manifestPath);
      if (entries.some((entry) => entry.file === file)) {
        throw new Error(`${manifestPath} already lists ${file}. Remove the stale entry or pick another project name.`);
      }
      const eol = originalManifest.includes("\r\n") ? "\r\n" : "\n";
      nextManifest = formatManifest([...entries, { file, project, source }], eol);
    }

    writeFileSync(destination, `${JSON.stringify(blueprint, null, 2)}\n`, { flag: "wx" });
    try {
      if (nextManifest !== undefined) writeFileSync(manifestPath, nextManifest);
      const runner = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
      const validator = fileURLToPath(new URL("./validate-blueprints.ts", import.meta.url));
      const result = spawnSync(process.execPath, [runner, validator], { stdio: "inherit" });
      if (result.error || result.status !== 0) {
        throw new Error(`Validation failed.${result.error ? ` ${result.error.message}` : ""}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const problems: string[] = [];
      if (originalManifest !== undefined) {
        try {
          writeFileSync(manifestPath, originalManifest);
        } catch (restoreError) {
          problems.push(`could not restore ${manifestPath}: ${String(restoreError)}`);
        }
      }
      try {
        rmSync(destination, { force: true });
      } catch (removeError) {
        problems.push(`could not remove ${destination}: ${String(removeError)}`);
      }
      const undone = originalManifest === undefined ? `Removed ${destination}.` : `Removed ${destination} and restored ${manifestPath}.`;
      throw new Error(
        problems.length > 0 ? `${message} Rollback incomplete: ${problems.join("; ")}.` : `${message} ${undone}`,
        { cause: error },
      );
    }
    const listedIn = originalManifest === undefined ? "" : ` and listed it in ${manifestPath}`;
    console.log(`Created ${destination}${listedIn}. Register it in src/App.tsx before viewing it.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
