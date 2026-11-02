import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function workflow() {
  return readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
}

describe("CI workflow", () => {
  it("runs on every push and pull request without branch or path filters", () => {
    expect(workflow()).toMatch(/^on:\n {2}push:\n {2}pull_request:\n/m);
    expect(workflow()).not.toMatch(/^\s+(branches|branches-ignore|paths|paths-ignore|if):/m);
  });

  it("installs locked dependencies and runs all quality gates in order", () => {
    const commands = [...workflow().matchAll(/^\s+run: (.+)$/gm)].map((match) => match[1]);
    expect(commands).toEqual([
      "npm ci",
      "npm run lint",
      "npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.node.json --noEmit",
      "npm test",
      "npm run validate-blueprints",
      "npm run build",
    ]);
    expect(workflow()).toContain("node-version-file: '.nvmrc'");
  });

  it("uses read-only permissions and requires no deployment secrets", () => {
    expect(workflow()).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(workflow()).not.toContain("secrets.");
    expect(workflow()).not.toContain("static-web-apps-deploy");
  });
});
