# agentFlow — Agent Instructions

> Project-specific instructions for AI coding agents.

## Build / Test / Deploy
```bash
npm install
npm run dev      # local dev (Vite)
npm run build    # production build
npm run lint
npm test
```

## Project conventions
- Stack: React + TypeScript + Vite, Azure SWA (Free tier)
- Auth: Google via SWA EasyAuth (when enabled)
- Secrets: SWA App Settings only (Free tier — no Managed Identity, no Key Vault refs)
- Infrastructure: `infrastructure/main.bicep` imports `../../.github/infrastructure/modules/swa.bicep`
- Deploy workflow: copied from `.github/workflow-templates/swa-deploy.yml`

## Off-path deviations
_None yet. Document any platform deviations here as they're introduced._

## Hypothesis
_What is this project trying to prove or disprove?_
