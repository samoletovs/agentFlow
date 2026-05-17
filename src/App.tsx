import { useEffect, useMemo, useState } from "react";
import { BlueprintCanvas } from "./components/BlueprintCanvas";
import type { AgentBlueprint } from "./lib/blueprint";
import mindMeRaw from "./blueprints/mindMe.json";
import agentModeRaw from "./blueprints/agentMode.json";
import atlasRaw from "./blueprints/atlas.json";
import autoRefineRaw from "./blueprints/autoRefine.json";

const BLUEPRINTS: AgentBlueprint[] = [
  mindMeRaw,
  agentModeRaw,
  atlasRaw,
  autoRefineRaw,
] as unknown as AgentBlueprint[];

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

  return (
    <div className="app">
      <header>
        <h1>agentFlow</h1>
        <span className="sub">how nauroLabs agents actually run</span>
        <div className="spacer" />
        {auth.signedIn ? (
          auth.allowed ? (
            <span className="auth-pill allowed" title={auth.email ?? ""}>
              <span className="dot" />
              {auth.email ?? "signed in"} · full view
            </span>
          ) : (
            <span className="auth-pill" title={auth.email ?? ""}>
              <span className="dot" />
              {auth.email ?? "signed in"} · not on allowlist
            </span>
          )
        ) : (
          <a
            className="auth-pill signedout"
            href="/.auth/login/aad?post_login_redirect_uri=/"
          >
            <span className="dot" />
            sign in<span className="hide-mobile"> for full view</span>
          </a>
        )}
      </header>

      <aside>
        {BLUEPRINTS.map((b) => (
          <div
            key={b.project}
            className={`project${b.project === selectedProject ? " active" : ""}`}
            onClick={() => setSelectedProject(b.project)}
          >
            <div className="name">{b.project}</div>
            <div className="agent">{b.agent}</div>
          </div>
        ))}
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
            .map((f) => (
              <button
                key={f.id}
                className={selectedFlow === f.id ? "active" : ""}
                onClick={() => setSelectedFlow(f.id)}
                title={f.trigger}
              >
                {f.label}
              </button>
            ))}
          <span className="summary">{blueprint.summary}</span>
        </div>
        <div className="canvas">
          <BlueprintCanvas
            blueprint={blueprint}
            flowId={selectedFlow}
            redactPrivate={redactPrivate}
          />
        </div>
      </main>
    </div>
  );
}
