// Validate every blueprint under src/blueprints/ against the schema.
// Exits non-zero on failure — wire into CI later.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface BlueprintShape {
  nodes: { id: string }[];
  flows: { id: string; steps: { from: string; to: string }[] }[];
}

const schemaPath = "src/lib/agent-blueprint.v1.schema.json";
const blueprintsDir = "src/blueprints";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const validate = ajv.compile(schema);

const files = readdirSync(blueprintsDir).filter((f: string) => f.endsWith(".json"));

let ok = true;
for (const file of files) {
  const data = JSON.parse(readFileSync(join(blueprintsDir, file), "utf-8")) as BlueprintShape;
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

if (!ok) {
  process.exit(1);
}
console.log(`\n${files.length} blueprint(s) validated.`);
