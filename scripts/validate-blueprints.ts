// Validate every blueprint under src/blueprints/ against the schema and the
// checked-in manifest (src/blueprints/manifest.json).
// Exits non-zero on failure; CI runs this before building.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface BlueprintShape {
  project: string;
  nodes: { id: string }[];
  flows: { id: string; steps: { from: string; to: string }[] }[];
}

const schemaPath = "src/lib/agent-blueprint.v1.schema.json";
const blueprintsDir = "src/blueprints";
const manifestFile = "manifest.json";
const manifestPath = `${blueprintsDir}/${manifestFile}`;
const repositoryPattern = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const validate = ajv.compile(schema);

const files = readdirSync(blueprintsDir).filter((f: string) => f.endsWith(".json") && f !== manifestFile);

if (files.length === 0) {
  console.error("No blueprint files found.");
  process.exit(1);
}

let ok = true;
const projects = new Map<string, unknown>();
for (const file of files) {
  const data = JSON.parse(readFileSync(join(blueprintsDir, file), "utf-8")) as BlueprintShape;
  projects.set(file, (data as { project?: unknown } | null)?.project);
  if (!validate(data)) {
    ok = false;
    console.error(`❌ ${file}`);
    for (const err of validate.errors ?? []) {
      console.error(`   ${err.instancePath || "/"} ${err.message}`);
    }
    continue;
  }

  // Referential integrity: every flow.step.from/to must resolve to a node.id.
  const nodeIds = new Set(data.nodes.map((n) => n.id));
  for (const flow of data.flows) {
    for (const step of flow.steps) {
      if (!nodeIds.has(step.from)) {
        ok = false;
        console.error(`❌ ${file} flow=${flow.id}: step.from='${step.from}' has no matching node`);
      }
      if (!nodeIds.has(step.to)) {
        ok = false;
        console.error(`❌ ${file} flow=${flow.id}: step.to='${step.to}' has no matching node`);
      }
    }
  }

  console.log(`✅ ${file}  (${data.nodes.length} nodes, ${data.flows.length} flows)`);
}

if (!checkManifest(files, projects)) {
  ok = false;
}

if (!ok) {
  process.exit(1);
}
console.log(`\n${files.length} blueprint(s) validated.`);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

// Every blueprint file must be listed once, every listed file must exist, and
// each blueprint's project must match its entry. A public source records
// "owner/repo" and a path; a private source records only "private".
function checkManifest(blueprintFiles: string[], blueprintProjects: Map<string, unknown>): boolean {
  if (!existsSync(manifestPath)) {
    console.warn(`⚠️  ${manifestPath} not found; skipped manifest coverage checks.`);
    return true;
  }

  const errors: string[] = [];
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch (error) {
    errors.push(`${manifestFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const entries: unknown[] | undefined =
    isRecord(manifest) && Array.isArray(manifest.blueprints) ? manifest.blueprints : undefined;
  if (errors.length === 0 && !entries) {
    errors.push(`${manifestFile} must be an object with a "blueprints" array.`);
  }

  const listed = new Map<string, string>();
  for (const [index, entry] of (entries ?? []).entries()) {
    const where = `${manifestFile} blueprints[${index}]`;
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ["file", "project", "source"]) ||
      typeof entry.file !== "string" ||
      typeof entry.project !== "string"
    ) {
      errors.push(`${where} needs string 'file' and 'project' fields and a 'source' object, and nothing else.`);
      continue;
    }
    const source = entry.source;
    if (isRecord(source) && source.repository === "private") {
      if (!hasExactKeys(source, ["repository"])) {
        errors.push(
          `${where} (${entry.file}): a private source must be exactly {"repository": "private"}; do not record its repository name or path.`,
        );
      }
    } else if (
      !isRecord(source) ||
      !hasExactKeys(source, ["repository", "path"]) ||
      typeof source.repository !== "string" ||
      !repositoryPattern.test(source.repository) ||
      typeof source.path !== "string" ||
      source.path.trim() === ""
    ) {
      errors.push(
        `${where} (${entry.file}): source must be {"repository": "<owner>/<repo>", "path": "<path>"} for a public repository, or {"repository": "private"}.`,
      );
    }
    if (listed.has(entry.file)) {
      errors.push(`${where} lists ${entry.file} more than once; keep one entry per blueprint.`);
      continue;
    }
    listed.set(entry.file, entry.project);
  }

  if (entries) {
    for (const [file, project] of listed) {
      if (!blueprintFiles.includes(file)) {
        errors.push(
          `${manifestFile} lists ${file}, but ${blueprintsDir}/${file} does not exist. Restore the blueprint or remove its manifest entry.`,
        );
      } else if (blueprintProjects.get(file) !== project) {
        errors.push(
          `${file}: project '${String(blueprintProjects.get(file))}' does not match manifest project '${project}'. Update the blueprint's "project" field or its manifest entry.`,
        );
      }
    }
    for (const file of blueprintFiles) {
      if (!listed.has(file)) {
        const project = blueprintProjects.get(file);
        errors.push(
          `${file} is not listed in ${manifestPath}. Add {"file": "${file}", "project": "${typeof project === "string" ? project : "<project>"}", "source": {"repository": "<owner>/<repo>", "path": "<path>"}} to its "blueprints" array; use {"repository": "private"} as the source of a private repository.`,
        );
      }
    }
  }

  for (const error of errors) {
    console.error(`❌ ${error}`);
  }
  if (errors.length === 0) {
    console.log(`✅ ${manifestFile} lists all ${blueprintFiles.length} blueprint(s) with matching projects.`);
  }
  return errors.length === 0;
}
