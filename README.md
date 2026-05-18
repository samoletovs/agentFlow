# agentFlow

> Visualize how nauroLabs agents work, what their components are, and how
> information flows between them.

Hosted at https://agentflow.naurolabs.com (`samoletovs/agentFlow`). Lab
experiment under [NauroLabs](https://naurolabs.com).

## What's inside

- **`src/blueprints/*.json`** — one declarative file per agent (mindMe,
  agentMode, atlas, autoRefine). Conforms to
  [`src/lib/agent-blueprint.v1.schema.json`](src/lib/agent-blueprint.v1.schema.json).
- **`src/components/BlueprintCanvas.tsx`** — React Flow renderer with animated
  edges, per-flow filtering, and `private: true` node redaction.
- **`src/App.tsx` (`EMAIL_ALLOWLIST`)** — client-side viewer allowlist.
  Anyone can see the public flows; signing in with Entra ID and being on the
  allowlist reveals private nodes and private flows. (SWA Free tier silently
  ignores `rolesSource`, so the gate is necessarily client-side.)
- **`scripts/validate-blueprints.ts`** — schema + referential-integrity check
  for every blueprint.

## Quick start

```bash
npm install
npm run dev                  # http://localhost:5173
npm run validate-blueprints  # ajv check + node-id integrity
npm run build
```

## Authentication model

| Visitor | Sees |
|---|---|
| Anonymous | All public nodes + all non-private flows. Private nodes render as "Restricted". |
| Signed in but not on allowlist | Same as anonymous, with a pill showing their email and "not on allowlist". |
| Signed in & on `EMAIL_ALLOWLIST` | Full graph — private nodes show real labels, private flows appear. |

`EMAIL_ALLOWLIST` is a constant in `src/App.tsx`. To add or remove a viewer,
edit the constant and commit — the next deploy ships the change. The list
is client-side only and is purely cosmetic (the blueprint JSON ships in the
bundle anyway; the gate just controls what's redacted).

## Adding a new agent blueprint

1. Drop a new file in `src/blueprints/<project>.json` matching the v1 schema.
2. Add the import to `src/App.tsx`'s `BLUEPRINTS` list.
3. Run `npm run validate-blueprints`.

The accompanying `agent-visualizer` skill in `.github/skills/agent-visualizer/`
contains a generator that does this end-to-end from a project's AGENTS.md and
infrastructure.

## Why this exists

Foundry / App Insights tracing UIs show *what happened on one invocation*.
agentFlow shows *what the agent is built out of and how it could ever run*.
You need both: tracing for debugging an incident, agentFlow for orienting a
new contributor or explaining the architecture in a 30-second screen-share.

## Status

- Phase 1 ✅ mindMe tracing wired into App Insights (2026-05-17).
- Phase 2 🟡 this app (in progress).
- Phase 3 ⏳ `agent-visualizer` skill for generating future blueprints.

