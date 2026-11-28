# agentFlow — Agent Instructions

Feedback triage uses `gpt-6-luna` on the existing personal-agents Azure account,
with reasoning disabled and a 300-token output ceiling. The visualizer itself
still has no embedded LLM.

> Project-specific instructions for AI coding agents.

## Project type

Lab-wide tool. Renders declarative `agent-blueprint.v1.json` files for the
agents in this workspace (mindMe, agentMode, atlas, autoRefine, …).

## Build / Test / Deploy

Use Node 22.13+ on the 22 LTS line (`.nvmrc`), or a version allowed by
`package.json`. CI uses Node 22 for both quality checks and frontend builds.
`npm test` must execute tests; blueprint validation and a production build are
also required in PR CI. Deployment uploads prebuilt `dist/` with the root
`staticwebapp.config.json` copied into it.

```bash
npm install
npm run dev                  # Vite — http://localhost:5173
npm run validate-blueprints  # ajv schema check + referential integrity + manifest coverage
npm run typecheck
npm run lint
npm run build                # production build to dist/
```

API (SWA-managed Functions) lives in `api/`:

```bash
cd api
npm install
npm run build
swa start ../dist --api-location . --run "npm run dev --prefix .."
```

## Hard rules

1. **The schema is the contract.** Every change to `agent-blueprint.v1.schema.json`
   needs a matching update to `src/lib/blueprint.ts` and to all four
   blueprint files. Run `npm run validate-blueprints` before committing.
2. **Private flag is single source of truth.** If a node touches personal data
   (Telegram chat ids, blob containers with personal content, key-vault items),
   it MUST carry `"private": true`. The renderer redacts these for anonymous
   visitors. Don't try to filter on the JS side — the JSON ships in the
   bundle, so the schema-level flag is what matters.
3. **The allowlist lives in `src/App.tsx` (`EMAIL_ALLOWLIST`).** SWA Free tier
   silently ignores `rolesSource`, so server-side role assignment isn't an
   option here — the gate is client-side and purely cosmetic (blueprint JSON
   ships in the bundle anyway; `private: true` controls what gets redacted for
   non-allowlisted viewers). To add a viewer, edit the constant and commit.
   See [PLATFORM.md §2](../.github/PLATFORM.md#2-authentication) for the
   Free-tier `rolesSource` trap.
4. **No third-party trackers, no analytics SDK, no remote fonts.** The CSP
   header enforces self-only `connect-src` and `script-src`.
5. **No real telemetry data in the bundle.** Blueprints describe the *shape*
   of the agent, not its runtime traces. Live trace timelines belong in
   App Insights / Foundry Tracing — link out, don't mirror.

## Project conventions

- Stack: React 18 + TypeScript + Vite, Azure SWA Free tier.
- Auth: Microsoft Entra ID via SWA built-in auth ([PLATFORM.md §2](../.github/PLATFORM.md#2-authentication)).
- Hosting: SWA Free + SWA-managed Functions for `/api`.
- Infrastructure: `infrastructure/main.bicep` (golden path — see PLATFORM.md §1).
- Deploy: `.github/workflows/swa-deploy.yml` (copied from the lab template).

## Adding a new blueprint

1. Generate a starter from the repository root (replace the example details):

   ```bash
   npm run create-blueprint -- --project sampleAgent --agent "Sample agent" --summary "Handles requests." --from-id input --from-kind channel --from-label "Input" --to-id worker --to-kind agent --to-label "Worker" --flow-id request --flow-label "Handle request" --source-repo samoletovs/sampleAgent --source-path .
   ```

   This writes `src/blueprints/sampleAgent.json`, adds its entry to
   `src/blueprints/manifest.json`, and runs the existing validator. For a
   private source use `--source-private` instead of `--source-repo` and
   `--source-path`. It will not overwrite a file, and it removes both changes
   if validation fails. Run `npm run create-blueprint -- --help` for
   the input and privacy options. Describe the actual architecture yourself;
   the starter does not infer it. Edit and extend the generated nodes and flows,
   marking personal-data nodes and flows private as appropriate.
2. In `src/App.tsx`, import the JSON (for example,
   `import sampleAgentRaw from "./blueprints/sampleAgent.json";`) and add
   `sampleAgentRaw` to the `BLUEPRINTS` array.
3. `npm run validate-blueprints` — must pass after edits.
4. `npm run dev` — visually verify the layout. If a node is in the wrong
   column, the cause is almost always a missing inbound edge.

Every blueprint must also have an entry in `src/blueprints/manifest.json`
(the generator adds it; add it yourself for a hand-written blueprint): `file`,
the expected `project`, and its `source`. A
public source is `{"repository": "<owner>/<repo>", "path": "<path>"}`, with
`"."` for the repository root. Record a private source only as
`{"repository": "private"}`, without its repository name or path.
The validator fails on unlisted files, listed files that do not exist and
project mismatches.

## Off-path deviations

None. agentFlow rides the SWA Free + Entra ID golden path.

## Hypothesis

Visualizing the static shape of an agent (components + flows) is a cheaper
unit of understanding than reading the codebase or staring at trace timelines.
If true, every new agent should ship with a blueprint at PR time. We'll find
out by tracking whether new contributors land their first PR faster on
projects that have a blueprint vs. those that don't.
