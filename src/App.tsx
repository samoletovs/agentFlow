import { useEffect, useMemo, useState } from "react";
import { BlueprintCanvas } from "./components/BlueprintCanvas";
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

interface AuthState {
  signedIn: boolean;
  email: string | null;
  allowed: boolean;
}

interface SwaPrincipal {
  userId?: string;
  userDetails?: string;
  userRoles?: string[];
  claims?: { typ?: string; val?: string }[];
}

async function loadAuth(): Promise<AuthState> {
  try {
    const r = await fetch("/.auth/me");
    if (!r.ok) return { signedIn: false, email: null, allowed: false };
    const j = (await r.json()) as { clientPrincipal: SwaPrincipal | null };
    const p = j.clientPrincipal;
    if (!p) return { signedIn: false, email: null, allowed: false };
    const emailClaim = p.claims?.find(
      (c) => c.typ === "emails" || c.typ === "preferred_username" || c.typ === "email",
    );
    const email = emailClaim?.val ?? p.userDetails ?? null;
    const allowed = (p.userRoles ?? []).includes("allowed");
    return { signedIn: true, email, allowed };
  } catch {
    return { signedIn: false, email: null, allowed: false };
  }
}

export default function App() {
  const [selectedProject, setSelectedProject] = useState(BLUEPRINTS[0].project);
  const [selectedFlow, setSelectedFlow] = useState("__all__");
  const [auth, setAuth] = useState<AuthState>({
    signedIn: false,
    email: null,
    allowed: false,
  });
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    loadAuth().then(setAuth);
  }, []);

  useEffect(() => {
    setSelectedFlow("__all__");
  }, [selectedProject]);

  const blueprint = useMemo(
    () => BLUEPRINTS.find((b) => b.project === selectedProject) ?? BLUEPRINTS[0],
    [selectedProject],
  );

  const redactPrivate = !auth.allowed;

  const hiddenStats = useMemo(() => {
    if (!redactPrivate) return { nodes: 0, flows: 0 };
    const nodes = blueprint.nodes.filter((n) => n.private === true).length;
    const flows = blueprint.flows.filter((f) => f.private === true).length;
    return { nodes, flows };
  }, [blueprint, redactPrivate]);

  // Display name: split lowerCamelCase project name into prefix + Suffix so we
  // can color the second word in the brand accent.
  const splitProjectName = (name: string): [string, string] => {
    const m = name.match(/^([a-z]+)([A-Z].*)$/);
    return m ? [m[1], m[2]] : [name, ""];
  };
  const [agentPrefix, agentSuffix] = splitProjectName("agentFlow");

  return (
    <div className="app">
      <header>
        <h1>
          {agentPrefix}
          <span className="brand-accent">{agentSuffix}</span>
        </h1>
        <span className="sub">how nauroLabs agents actually run</span>
        <div className="spacer" />
        <button
          className="legend-toggle"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          title="Show node kinds"
        >
          legend
        </button>
        {auth.signedIn ? (
          auth.allowed ? (
            <span className="auth-pill allowed" title={auth.email ?? ""}>
              <span className="dot" />
              <span className="auth-text">{auth.email ?? "signed in"}</span>
            </span>
          ) : (
            <span className="auth-pill" title={auth.email ?? ""}>
              <span className="dot" />
              <span className="auth-text">{auth.email ?? "signed in"} · not on allowlist</span>
            </span>
          )
        ) : (
          <a
            className="auth-pill signedout"
            href="/.auth/login/aad?post_login_redirect_uri=/"
          >
            <span className="dot" />
            <span className="auth-text">
              sign in<span className="hide-mobile"> for full view</span>
            </span>
          </a>
        )}
      </header>

      <aside>
        <div className="aside-section-label">Agents</div>
        {BLUEPRINTS.map((b) => {
          const [prefix, suffix] = splitProjectName(b.project);
          return (
            <div
              key={b.project}
              className={`project${b.project === selectedProject ? " active" : ""}`}
              onClick={() => setSelectedProject(b.project)}
            >
              <div className="name">
                {prefix}
                {suffix ? <span className="project-accent">{suffix}</span> : null}
              </div>
              <div className="agent">{b.agent}</div>
              {b.tags && b.tags.length > 0 ? (
                <div className="tags">
                  {b.tags.slice(0, 3).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="aside-about">
          <strong>About</strong>
          <p>
            agentFlow visualises how every nauroLabs agent works — its
            components, triggers, and how information flows between them.
            Pick an agent, then a flow.
          </p>
        </div>
      </aside>

      <main>
        <div className="toolbar">
          <button
            className={selectedFlow === "__all__" ? "active" : ""}
            onClick={() => setSelectedFlow("__all__")}
          >
            All flows
          </button>
          {blueprint.flows
            .filter((f) => !redactPrivate || f.private !== true)
            .map((f, idx) => (
              <button
                key={f.id}
                className={`flow-tab${selectedFlow === f.id ? " active" : ""}`}
                onClick={() => setSelectedFlow(f.id)}
                title={f.trigger}
                style={
                  {
                    "--flow-color": `var(--flow-${idx % 6})`,
                  } as React.CSSProperties
                }
              >
                <span className="flow-dot" />
                {f.label}
              </button>
            ))}
        </div>
        <div className="summary-row">{blueprint.summary}</div>
        {redactPrivate && (hiddenStats.nodes > 0 || hiddenStats.flows > 0) ? (
          <div className="hidden-banner">
            <span>
              {hiddenStats.nodes > 0
                ? `${hiddenStats.nodes} node${hiddenStats.nodes === 1 ? "" : "s"} restricted`
                : ""}
              {hiddenStats.nodes > 0 && hiddenStats.flows > 0 ? " · " : ""}
              {hiddenStats.flows > 0
                ? `${hiddenStats.flows} flow${hiddenStats.flows === 1 ? "" : "s"} hidden`
                : ""}
            </span>
            <a href="/.auth/login/aad?post_login_redirect_uri=/">
              Sign in for full view →
            </a>
          </div>
        ) : null}
        <div className="canvas">
          <BlueprintCanvas
            key={`${blueprint.project}:${selectedFlow}`}
            blueprint={blueprint}
            flowId={selectedFlow}
            redactPrivate={redactPrivate}
          />
          {legendOpen ? (
            <div className="legend" role="dialog" aria-label="Node kinds">
              <div className="legend-head">
                <strong>Node kinds</strong>
                <button
                  className="legend-close"
                  onClick={() => setLegendOpen(false)}
                  aria-label="Close legend"
                >
                  ×
                </button>
              </div>
              <ul>
                {NODE_KINDS.map(({ kind, label }) => (
                  <li key={kind}>
                    <span className={`kind-dot kind-dot-${kind}`} />
                    {label}
                  </li>
                ))}
              </ul>
              <div className="legend-note">
                Edges are coloured per flow. Hover a node to highlight its
                neighbours.
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
