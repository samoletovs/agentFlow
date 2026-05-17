// TypeScript mirror of agent-blueprint.v1.schema.json — keep in sync.
// The .json file is the contract; this file is the developer ergonomic.

export const BLUEPRINT_VERSION = "1.0" as const;

export type NodeKind =
  | "channel"
  | "trigger"
  | "compute"
  | "tool"
  | "data"
  | "secret"
  | "agent"
  | "job"
  | "repo"
  | "pwa";

export interface BlueprintNode {
  id: string;
  kind: NodeKind;
  label: string;
  detail?: string;
  resource?: string;
  /** If true, anonymous visitors see "Restricted" instead of `label`. */
  private?: boolean;
  url?: string;
}

export interface BlueprintFlowStep {
  from: string;
  to: string;
  label?: string;
}

export interface BlueprintFlow {
  id: string;
  label: string;
  trigger?: string;
  /** If true, anonymous visitors don't see this flow at all. */
  private?: boolean;
  steps: BlueprintFlowStep[];
}

export interface BlueprintTelemetry {
  appInsights?: boolean;
  tracerName?: string;
}

export interface AgentBlueprint {
  version: typeof BLUEPRINT_VERSION;
  project: string;
  agent: string;
  summary: string;
  tags?: string[];
  stack?: string[];
  telemetry?: BlueprintTelemetry;
  nodes: BlueprintNode[];
  flows: BlueprintFlow[];
}
