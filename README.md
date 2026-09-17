# agentFlow

agentFlow renders declarative NauroLabs agent blueprints as Dispatch Lab:
an illustrated, explorable system of components and information flows.

## Research question

agentFlow tests the NauroLabs question **"Can a company run itself?"** It asks
whether agents can build and operate a lab without making their architecture
illegible to the human responsible for supervising it.

## What it does

- Validates agent blueprints against a versioned JSON schema.
- Renders an original cel-illustrated lab, with reusable mechanisms for each
  component kind and a precise React Flow diagram as an alternative view.
- Plays declared handoffs individually or as a controllable walkthrough.
- Filters views by flow and visually redacts nodes marked private.
- Searches the visible flow list by name, ID, trigger or blueprint tag.
- Provides public and signed-in views of the same static architecture model.

Each agent opens on its first visible flow so a walkthrough is immediately
available. All flows remains available as an overview. Flow search updates as
you type; a selected flow that no longer matches resets to All flows. Switching
agents clears the search and starts with that agent's first visible flow.
Private flows remain hidden from public viewers, including in search results.

## Explore Dispatch Lab

Select a mechanism to inspect its declared responsibility, resource information
and incoming/outgoing relationships. The agent catalogue describes every
available blueprint; the lab guide explains the component kinds.

**Play full flow** follows the ordered handoff occurrences, including repeated
visits and returns. Pause, resume, inspect a component, play a single handoff,
or stop/reset. The readable outline allows direct step selection. A source
change is explained explicitly rather than drawn as an invented continuous
chain. Reduced-motion preferences retain the same information through static
states.

**Lab** is the illustrated experience. **Diagram** is a stable technical map
with the existing pan, zoom and neighborhood inspection; walkthrough animation
belongs to the lab. On small screens the lab follows the selected relationship
rather than relying only on a miniature whole-system diagram.

The blueprint JSON is shipped to the browser. Private-node redaction is a
presentation control, not a security boundary; blueprints must never contain
secrets or real telemetry. Play/Pause controls an illustration, not a running
agent. Actual execution traces belong in authorized observability tools.

## Stack

- React, TypeScript, Vite, original SVG illustration, and React Flow
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

The Vite development server supplies an anonymous `/.auth/me` response for local
public-view work. Real Microsoft Entra sign-in is provided by the deployed SWA
host. Sign-in failures on that host remain fail-closed, with an explicit status
message and retry action; the client-side allowlist remains in `src/App.tsx`.

Before submitting a change:

```powershell
npm run validate-blueprints
npm run typecheck
npm run lint
npm test
npm run build
```

The tests cover the blueprint contract, flow search, public-view projection,
playback transitions and rendered application markup. Before delivery, also
check the real browser experience across the agent catalogue: flow selection,
repeated/return handoffs, pause/reset, component inspection, public/full-view
transitions, keyboard operation and mobile/reduced-motion behavior.

## Status

**Active lab tool.** The schema, renderer, visibility treatment, and current
blueprints are implemented. Blueprint coverage must continue to be updated as
the agent portfolio changes.

## License

MIT
