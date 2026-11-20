import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
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
  help: { type: "boolean" },
} as const;

const usage = `Usage: npm run create-blueprint -- --project NAME --agent NAME --summary TEXT \\
  --from-id ID --from-kind KIND --from-label LABEL --to-id ID --to-kind KIND --to-label LABEL \\
  --flow-id ID --flow-label LABEL [--from-private] [--to-private] [--flow-private]

Project names must match ^[a-z][a-zA-Z]+$. Node and flow IDs use lowercase letters,
digits, and underscores. Kinds: channel, trigger, compute, tool, data, secret,
agent, job, repo, pwa. Mark nodes or flows that touch personal data as private.`;

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
    const destination = join("src", "blueprints", `${project}.json`);
    writeFileSync(destination, `${JSON.stringify(blueprint, null, 2)}\n`, { flag: "wx" });
    const runner = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
    const validator = fileURLToPath(new URL("./validate-blueprints.ts", import.meta.url));
    const result = spawnSync(process.execPath, [runner, validator], { stdio: "inherit" });
    if (result.error || result.status !== 0) {
      rmSync(destination);
      throw new Error(`Validation failed; removed ${destination}.${result.error ? ` ${result.error.message}` : ""}`);
    }
    console.log(`Created ${destination}. Register it in src/App.tsx before viewing it.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
