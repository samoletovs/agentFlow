import { useEffect, useRef, useState } from "react";
import type { AgentBlueprint, NodeKind } from "../lib/blueprint";
import { loadViewerAuth, PUBLIC_VIEWER, type ViewerAuth } from "../lib/auth";
import { BlueprintErrorBoundary } from "./BlueprintErrorBoundary";
import { DispatchLab } from "./DispatchLab";

interface Props {
  blueprints: readonly AgentBlueprint[];
  allowlist: readonly string[];
  nodeKinds: readonly { kind: NodeKind; label: string }[];
}

function ProjectName({ name }: { name: string }) {
  const parts = name.match(/^([a-z]+)([A-Z].*)$/);
  return parts ? <>{parts[1]}<span className="brand-accent">{parts[2]}</span></> : <>{name}</>;
}

export function DispatchApplication({ blueprints, allowlist, nodeKinds }: Props) {
  const [blueprint, setBlueprint] = useState(blueprints[0]);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [auth, setAuth] = useState<ViewerAuth>({ ...PUBLIC_VIEWER, status: "loading" });
  const [authAttempt, setAuthAttempt] = useState(0);
  const [pauseRequest, setPauseRequest] = useState(0);
  const agentButton = useRef<HTMLButtonElement>(null);
  const guideButton = useRef<HTMLButtonElement>(null);

  function pauseForReading() {
    setPauseRequest((request) => request + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    loadViewerAuth(allowlist, { signal: controller.signal })
      .then((viewer) => {
        if (!controller.signal.aborted) setAuth(viewer);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Unable to check sign-in status.", error instanceof Error ? error.message : "Unknown error");
        setAuth({
          ...PUBLIC_VIEWER,
          status: "error",
          error: "Sign-in status could not be checked. The public view is shown.",
        });
      });
    return () => controller.abort();
  }, [allowlist, authAttempt]);

  function refreshAccess() {
    setAuth({ ...PUBLIC_VIEWER, status: "loading" });
    setAuthAttempt((attempt) => attempt + 1);
  }

  function closeCatalogue() {
    setCatalogueOpen(false);
    agentButton.current?.focus();
  }

  function closeGuide() {
    setGuideOpen(false);
    guideButton.current?.focus();
  }

  if (!blueprint) {
    return <main className="lab-error" role="alert"><h1>No agent blueprint is available.</h1><p>Add a valid blueprint before opening Dispatch Lab.</p></main>;
  }

  return (
    <div className="lab-app" data-access={auth.allowed ? "full" : "public"} data-testid="dispatch-application">
      <a className="skip-link" href="#lab-main">Skip to the lab</a>
      <header className="site-header">
        <a className="site-brand" href="/" aria-label="agentFlow home"><ProjectName name="agentFlow" /></a>
        <span className="site-caption">Dispatch Lab</span>
        <button
          ref={agentButton}
          className="agent-menu-toggle"
          aria-controls="agent-catalogue"
          aria-expanded={catalogueOpen}
          onClick={() => {
            if (!catalogueOpen) pauseForReading();
            setCatalogueOpen((open) => !open);
            setGuideOpen(false);
          }}
        >
          <span><ProjectName name={blueprint.project} /></span><span aria-hidden="true">⌄</span>
        </button>
        <nav className="site-actions" aria-label="Lab information and access">
          <button
            ref={guideButton}
            className="text-button"
            aria-label="How to read the lab"
            aria-expanded={guideOpen}
            aria-controls="lab-guide"
            onClick={() => {
              if (!guideOpen) pauseForReading();
              setGuideOpen((open) => !open);
              setCatalogueOpen(false);
            }}
          ><span className="desktop-label">How to read the lab</span><span className="mobile-label">Guide</span></button>
          {auth.status === "loading" ? (
            <span className="access-check" role="status">Checking access…</span>
          ) : auth.status === "signed-in" ? (
            <details className="access-details" onToggle={(event) => {
              if (event.currentTarget.open) pauseForReading();
            }}>
              <summary className={auth.allowed ? "access-full" : ""}>{auth.allowed ? "Full view" : "Restricted view"}</summary>
              <div className="access-popover">
                <strong>Signed in</strong>
                <p>{auth.email ?? "No email supplied"}</p>
                <p>{auth.allowed ? "Your account is on the viewer allowlist." : "Your account is not on the viewer allowlist. Private details stay redacted."}</p>
                <button onClick={refreshAccess}>Refresh access</button>
                <a href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a>
              </div>
            </details>
          ) : (
            <a className="sign-in-link" href="/.auth/login/aad?post_login_redirect_uri=/">Sign in<span className="desktop-label"> for full view</span></a>
          )}
        </nav>
      </header>

      {auth.error ? (
        <div className="access-error" role="alert"><span>{auth.error}</span><button onClick={refreshAccess}>Retry access check</button></div>
      ) : null}

      {catalogueOpen ? (
        <section
          id="agent-catalogue"
          className="agent-catalogue"
          aria-labelledby="catalogue-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeCatalogue();
            }
          }}
        >
          <div className="panel-heading"><h2 id="catalogue-title">Choose an agent</h2><button onClick={closeCatalogue} aria-label="Close agent catalogue">×</button></div>
          <div className="agent-index">
            {blueprints.map((candidate) => (
              <button
                key={candidate.project}
                className="agent-option"
                aria-pressed={candidate.project === blueprint.project}
                onClick={() => {
                  setBlueprint(candidate);
                  closeCatalogue();
                }}
              >
                <span className="agent-option-name"><strong><ProjectName name={candidate.project} /></strong><span>{candidate.agent}</span></span>
                <span className="agent-option-summary">{candidate.summary}</span>
                <span className="agent-option-tags">{candidate.tags?.join(" · ")}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {guideOpen ? (
        <section id="lab-guide" className="lab-guide" aria-labelledby="guide-title" onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeGuide();
          }
        }}>
          <div className="panel-heading"><h2 id="guide-title">An illustration of a real blueprint</h2><button onClick={closeGuide} aria-label="Close lab guide">×</button></div>
          <div className="guide-columns">
            <div>
              <p>Each mechanism represents a declared software component. Room positions group roles, not execution order; only arrows declare relationships. Select a mechanism to inspect its responsibility and connections, or choose a flow to follow its handoffs.</p>
              <p>Play and Pause control an explanation—not a running agent. The Diagram view provides a precise component map alongside the illustrated lab.</p>
            </div>
            <div>
              <ul className="kind-legend">{nodeKinds.map(({ kind, label }) => <li key={kind}><span className={`kind-dot kind-dot-${kind}`} />{label}</li>)}</ul>
              <p className="privacy-note">Private flags control presentation. Blueprint JSON is delivered to the browser, so redaction is not a security boundary and blueprints must never contain secrets or real telemetry.</p>
            </div>
          </div>
        </section>
      ) : null}

      <BlueprintErrorBoundary key={blueprint.project}>
        <DispatchLab key={blueprint.project} blueprint={blueprint} redactPrivate={!auth.allowed} pauseRequest={pauseRequest} />
      </BlueprintErrorBoundary>
    </div>
  );
}
