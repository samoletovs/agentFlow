targetScope = 'resourceGroup'

@description('Project name (lowerCamelCase)')
param projectName string = 'agentflow'

@description('Azure region')
param location string = 'northeurope'

@description('Custom domain (optional)')
param customDomain string = 'agentflow.naurolabs.com'

var tags = {
  project: projectName
  managedBy: 'bicep'
  costCenter: 'naurolabs-research'
}

module monitoring '../../.github/infrastructure/modules/monitoring.bicep' = {
  name: 'monitoring-${projectName}'
  params: {
    projectName: projectName
    location: location
    tags: tags
  }
}

module swa '../../.github/infrastructure/modules/swa.bicep' = {
  name: 'swa-${projectName}'
  params: {
    projectName: projectName
    location: 'westeurope' // SWA Free tier is region-restricted; RG stays in northeurope
    customDomain: customDomain
    tags: tags
  }
}

output swaHostname string = swa.outputs.defaultHostname
output appInsightsConnectionString string = monitoring.outputs.connectionString
