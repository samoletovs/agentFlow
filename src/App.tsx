import { DispatchApplication } from "./components/DispatchApplication";
import type { AgentBlueprint } from "./lib/blueprint";
import mindMeRaw from "./blueprints/mindMe.json";
import agentModeRaw from "./blueprints/agentMode.json";
import atlasRaw from "./blueprints/atlas.json";
import autoRefineRaw from "./blueprints/autoRefine.json";
import foundryLabRaw from "./blueprints/foundryLab.json";
import turgoRaw from "./blueprints/turgo.json";

const BLUEPRINTS: AgentBlueprint[] = [
  mindMeRaw,
  agentModeRaw,
  atlasRaw,
  autoRefineRaw,
  foundryLabRaw,
  turgoRaw,
] as unknown as AgentBlueprint[];

const NODE_KINDS = [
  { kind: "channel", label: "Channel" },
  { kind: "trigger", label: "Trigger" },
  { kind: "compute", label: "Compute" },
  { kind: "agent", label: "Agent" },
  { kind: "tool", label: "Tool" },
  { kind: "data", label: "Data" },
  { kind: "secret", label: "Secret" },
  { kind: "job", label: "Job" },
  { kind: "repo", label: "Repo" },
  { kind: "pwa", label: "App" },
] as const;

// Emails permitted to see un-redacted blueprint details. Kept client-side
// because SWA Free tier silently ignores the rolesSource function used to
// assign custom roles (that feature requires the Standard plan). The gate
// is cosmetic — the blueprint data is bundled into the JS anyway — so a
// client-side allowlist matches the security posture and avoids the cost.
const EMAIL_ALLOWLIST = ["146099412+samoletovs@users.noreply.github.com"];

export default function App() {
  return (
    <DispatchApplication
      blueprints={BLUEPRINTS}
      allowlist={EMAIL_ALLOWLIST}
      nodeKinds={NODE_KINDS}
    />
  );
}
