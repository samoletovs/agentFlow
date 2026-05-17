# agentFlow — Agent Instructions

> Project-specific instructions for AI coding agents.

## Project type

Lab-wide tool. Renders declarative `agent-blueprint.v1.json` files for the
agents in this workspace (mindMe, agentMode, atlas, autoRefine, …).

## Build / Test / Deploy

```bash
npm install
npm run dev                  # Vite — http://localhost:5173
npm run validate-blueprints  # ajv schema check + referential integrity
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
3. **`ALLOWED_EMAILS` is the only allowlist.** Don't hardcode emails in source.
   Don't ship a fallback list. `GetRoles.ts` reads the env var fresh on every
   sign-in.
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

1. Create `src/blueprints/<project>.json` matching the v1 schema.
2. Add the import in `src/App.tsx` `BLUEPRINTS` array.
3. `npm run validate-blueprints` — must pass.
4. `npm run dev` — visually verify the layout. If a node is in the wrong
   column, the cause is almost always a missing inbound edge.

## Off-path deviations

None. agentFlow rides the SWA Free + Entra ID golden path.

## Hypothesis

Visualizing the static shape of an agent (components + flows) is a cheaper
unit of understanding than reading the codebase or staring at trace timelines.
If true, every new agent should ship with a blueprint at PR time. We'll find
out by tracking whether new contributors land their first PR faster on
projects that have a blueprint vs. those that don't.
