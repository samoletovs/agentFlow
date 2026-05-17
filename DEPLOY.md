# agentFlow — Deploy Runbook

> Local app is complete and committed (`master 071291f`). This runbook
> documents the exact steps required to put it live at
> https://agentflow.naurolabs.com. These steps were intentionally not run
> autonomously because they create shared infrastructure (GitHub repo, Azure
> resources, Entra ID app registration with secret, DNS record).

## Pre-flight

Verify the local app still builds:

```bash
cd agentFlow
npm install
npm run validate-blueprints   # ✅ 4 blueprints
npm run typecheck             # ✅ clean
npm run build                 # ✅ 340 kB / 110 kB gzipped
npm run dev                   # spot-check at http://localhost:5173
```

## Step 1 — Create GitHub repo

```bash
cd agentFlow
gh repo create samoletovs/agentFlow --public \
  --description "Visualize how nauroLabs agents work" \
  --source=. --remote=origin
git push -u origin master
```

## Step 2 — Create Azure resource group & deploy Bicep

```bash
az group create --name agentflow-rg --location northeurope

az deployment group create \
  --resource-group agentflow-rg \
  --template-file infrastructure/main.bicep \
  --parameters projectName=agentflow location=northeurope \
              customDomain=agentflow.naurolabs.com
```

Capture the outputs:

```bash
az deployment group show \
  --resource-group agentflow-rg --name main \
  --query "properties.outputs" -o json
# → swaHostname, appInsightsConnectionString
```

## Step 3 — Get the SWA deployment token

```bash
az staticwebapp secrets list \
  --name agentflow-swa --resource-group agentflow-rg \
  --query "properties.apiKey" -o tsv
```

Save that as a GitHub repo secret:

```bash
gh secret set AZURE_SWA_TOKEN --repo samoletovs/agentFlow \
  --body "<paste-token-here>"
```

Also copy `TELEGRAM_NOTIFY_URL` from any other repo's secrets:

```bash
gh secret set TELEGRAM_NOTIFY_URL --repo samoletovs/agentFlow \
  --body "<paste-url-here>"
```

## Step 4 — Register Entra ID app for SWA auth

This must be interactive (consent screen + admin grant). Run with `146099412+samoletovs@users.noreply.github.com`:

```bash
# Replace <SWA_HOSTNAME> with the value from step 2.
APP_NAME=agentflow-aad
SWA_HOSTNAME=<placeholder>  # e.g. agentflow-swa-abc123.azurestaticapps.net

# Create the app registration with the right redirect URI
az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience AzureADandPersonalMicrosoftAccount \
  --web-redirect-uris "https://$SWA_HOSTNAME/.auth/login/aad/callback" \
                      "https://agentflow.naurolabs.com/.auth/login/aad/callback"

APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)

# Create a client secret (valid 24 months)
CLIENT_SECRET=$(az ad app credential reset --id "$APP_ID" \
  --years 2 --query "password" -o tsv)
```

## Step 5 — Set SWA app settings

```bash
az staticwebapp appsettings set \
  --name agentflow-swa --resource-group agentflow-rg \
  --setting-names \
    AAD_CLIENT_ID="$APP_ID" \
    AAD_CLIENT_SECRET="$CLIENT_SECRET" \
    ALLOWED_EMAILS="146099412+samoletovs@users.noreply.github.com"
```

Adding friends later is one command:

```bash
az staticwebapp appsettings set \
  --name agentflow-swa --resource-group agentflow-rg \
  --setting-names ALLOWED_EMAILS="146099412+samoletovs@users.noreply.github.com,friend@example.com"
```

## Step 6 — DNS (Google Cloud DNS, project `era-erp`)

```bash
gcloud --project era-erp dns record-sets create agentflow.naurolabs.com \
  --zone naurolabs --type CNAME --ttl 300 \
  --rrdatas "$SWA_HOSTNAME."
```

## Step 7 — Bind the custom domain

```bash
az staticwebapp hostname set \
  --name agentflow-swa --resource-group agentflow-rg \
  --hostname agentflow.naurolabs.com
```

## Step 8 — Push & let CI/CD ship it

The first push to `master` after step 3 will trigger the SWA deploy workflow.
You can also re-run manually:

```bash
gh workflow run "CI/CD" --repo samoletovs/agentFlow
```

## Step 9 — Smoke test

```bash
curl -s https://agentflow.naurolabs.com | head -5    # ✅ HTML
curl -s https://agentflow.naurolabs.com/api/GetRoles \
  -X POST -d '{}' -H "content-type: application/json"
# → {"roles":[]}    (no allowlist match for anonymous body)
```

Open the site, click "sign in for full view", complete the AAD flow, and
verify private nodes/flows now show their real labels.

## Cost expectation

| Resource | SKU | Monthly |
|---|---|---|
| SWA Free | Free | €0 |
| Log Analytics + App Insights (≤0.1 GB/day) | PAYG with daily cap | €0 |
| Entra ID app registration | Free | €0 |
| Google Cloud DNS A record | shared zone | €0 |
| **Total** | | **€0** |

## Rollback

If anything goes wrong:

```bash
az group delete --name agentflow-rg --yes --no-wait
gcloud --project era-erp dns record-sets delete agentflow.naurolabs.com \
  --zone naurolabs --type CNAME
az ad app delete --id "$APP_ID"
```

Local `master` is untouched; the GitHub repo can be archived or deleted from
the GitHub UI.
