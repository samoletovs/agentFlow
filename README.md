# agentFlow

agentFlow renders declarative NauroLabs agent blueprints as interactive
component-and-flow diagrams.

## Research question

agentFlow tests the NauroLabs question **"Can a company run itself?"** It asks
whether agents can build and operate a lab without making their architecture
illegible to the human responsible for supervising it.

## What it does

- Validates agent blueprints against a versioned JSON schema.
- Renders nodes and animated information flows with React Flow.
- Filters diagrams by flow and visually redacts nodes marked private.
- Searches the visible flow list by name, ID, trigger or blueprint tag.
- Provides public and signed-in views of the same static architecture model.

Flow search updates as you type. A selected flow that no longer matches resets
to All flows; switching agents clears the search. Private flows remain hidden
from anonymous visitors, including in search results.

The blueprint JSON is shipped to the browser. Private-node redaction is a
presentation control, not a security boundary; blueprints must never contain
secrets or real telemetry.

## Stack

- React 18, TypeScript, Vite, and React Flow
- AJV schema validation
- Azure Static Web Apps with Microsoft Entra ID
- Bicep infrastructure

## Run locally

Use Node 22.13+ on the 22 LTS line (`.nvmrc`), or another version allowed by
`package.json`. Vitest 5 no longer supports Node 20. CI builds and tests on
Node 22, then deploys the prebuilt frontend with its SWA configuration.

```powershell
npm install
npm run dev
```

Before submitting a change:

```powershell
npm run validate-blueprints
npm run typecheck
npm run lint
npm test
npm run build
```

## Status

**Active lab tool.** The schema, renderer, visibility treatment, and current
blueprints are implemented. Blueprint coverage must continue to be updated as
the agent portfolio changes.

## License

MIT
