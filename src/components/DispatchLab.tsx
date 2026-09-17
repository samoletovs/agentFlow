import { lazy, Suspense, useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AgentBlueprint } from "../lib/blueprint";
import type { DispatchNode, DispatchStep } from "../lib/dispatchTypes";
import { createDispatchModel, getFlowNodes } from "../lib/dispatchModel";
import { filterFlows, queryForSelectedFlow } from "../lib/flowSearch";
import { useFlowPlayback } from "../hooks/useFlowPlayback";
import { DispatchStage } from "./DispatchStage";

const ALL_FLOWS = "__all__";
const NO_STEPS: readonly DispatchStep[] = [];
const TechnicalDiagram = lazy(() =>
  import("./BlueprintCanvas").then((module) => ({ default: module.BlueprintCanvas })),
);

function useMediaQuery(query: string) {
  const subscribe = useCallback((listener: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

interface Props {
  blueprint: AgentBlueprint;
  redactPrivate: boolean;
}

export function DispatchLab({ blueprint, redactPrivate }: Props) {
  const model = useMemo(() => createDispatchModel(blueprint, redactPrivate), [blueprint, redactPrivate]);
  const [selectedFlow, setSelectedFlow] = useState(() => model.flows[0]?.id ?? ALL_FLOWS);
  const [search, setSearch] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<"lab" | "diagram">("lab");
  const [chosenView, setChosenView] = useState<"overview" | "follow" | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const returnFocus = useRef<Element | null>(null);
  const inspectorTitle = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const narrow = useMediaQuery("(max-width: 760px)");
  const viewMode = chosenView ?? (narrow ? "follow" : "overview");
  const flowId = model.flows.some((flow) => flow.id === selectedFlow) ? selectedFlow : ALL_FLOWS;
  const activeFlow = model.flows.find((flow) => flow.id === flowId);
  const flows = useMemo(() => activeFlow ? [activeFlow] : model.flows, [activeFlow, model.flows]);
  const nodes = useMemo(() => getFlowNodes(model, activeFlow), [model, activeFlow]);
  const filteredFlows = useMemo(() => filterFlows(model.flows, blueprint.tags, search), [model.flows, blueprint.tags, search]);
  const playback = useFlowPlayback({
    steps: activeFlow?.steps ?? NO_STEPS,
    contextKey: `${model.project}:${flowId}:${redactPrivate ? "public" : "full"}`,
    reducedMotion,
  });
  const { state, pause } = playback;
  const activeStep = activeFlow?.steps[state.stepIndex] ?? null;
  const selectedNode = model.nodes.find((node) => node.id === selectedNodeId);
  const hiddenNodes = redactPrivate ? blueprint.nodes.filter((node) => node.private).length : 0;
  const hiddenFlows = redactPrivate ? blueprint.flows.filter((flow) => flow.private).length : 0;
  const canPlay = !!activeFlow?.steps.length;
  const isPlaying = state.status === "playing";
  const primaryLabel = presentation === "diagram"
    ? "Animate in the lab"
    : state.status === "paused" && state.mode === "flow"
      ? "Resume flow"
      : state.status === "completed" && state.mode === "flow"
        ? "Replay flow"
        : "Play full flow";

  const technicalBlueprint = useMemo<AgentBlueprint>(() => ({
    ...blueprint,
    nodes: [...model.nodes],
    flows: model.flows.map((flow) => ({ ...flow, steps: [...flow.steps] })),
  }), [blueprint, model.nodes, model.flows]);

  const connections = useMemo(
    () => selectedNode
      ? model.flows.flatMap((flow) => flow.steps.filter((step) => step.from === selectedNode.id || step.to === selectedNode.id))
      : [],
    [model.flows, selectedNode],
  );

  function chooseFlow(id: string) {
    playback.reset();
    setSelectedNodeId(null);
    const selected = model.flows.find((flow) => flow.id === id);
    if (id !== ALL_FLOWS && !selected) {
      setSelectedFlow(ALL_FLOWS);
      setSelectionMessage("That flow is no longer available. The visible overview is shown.");
      return;
    }
    setSelectionMessage(null);
    if (selected) setSearch(queryForSelectedFlow(selected, blueprint.tags, search));
    setSelectedFlow(id);
  }

  function changeSearch(query: string) {
    setSearch(query);
    setSelectionMessage(null);
    if (flowId !== ALL_FLOWS && !filterFlows(model.flows, blueprint.tags, query).some((flow) => flow.id === flowId)) {
      playback.reset();
      setSelectedFlow(ALL_FLOWS);
      setSelectedNodeId(null);
    }
  }

  const inspectNode = useCallback((id: string) => {
    if (!model.nodes.some((node) => node.id === id)) {
      setSelectionMessage("That component is no longer available in this blueprint.");
      return;
    }
    const focused = document.activeElement;
    if (!focused?.closest(".component-panel")) returnFocus.current = focused;
    pause();
    if (!nodes.some((node) => node.id === id)) setSelectedFlow(ALL_FLOWS);
    setSelectedNodeId(id);
    setChosenView("follow");
    requestAnimationFrame(() => inspectorTitle.current?.focus({ preventScroll: !narrow }));
  }, [model.nodes, nodes, pause, narrow]);

  function closeInspector() {
    setSelectedNodeId(null);
    const target = returnFocus.current;
    if (target?.isConnected && "focus" in target && typeof target.focus === "function") target.focus();
    else document.querySelector<HTMLSelectElement>('[data-testid="flow-selector"]')?.focus();
  }

  function switchPresentation(next: "lab" | "diagram") {
    playback.pause();
    setPresentation(next);
  }

  function startFlow() {
    setSelectedNodeId(null);
    setPresentation("lab");
    setChosenView("follow");
    playback.playFlow();
  }

  function playHandoff(index?: number) {
    setSelectedNodeId(null);
    setPresentation("lab");
    setChosenView("follow");
    playback.playStep(index);
  }

  function moveHandoff(direction: "next" | "previous") {
    setSelectedNodeId(null);
    setPresentation("lab");
    setChosenView("follow");
    playback[direction]();
  }

  function reference(node: DispatchNode) {
    if (!node.url) return null;
    return /^https?:\/\//i.test(node.url)
      ? <a href={node.url} target="_blank" rel="noopener noreferrer">Open declared reference ↗</a>
      : <code className="resource-value">{node.url}</code>;
  }

  return (
    <main
      id="lab-main"
      className="dispatch-workspace"
      data-testid="dispatch-lab"
      data-project={model.project}
      data-flow-id={flowId}
      data-playback-state={state.status}
      data-playback-mode={state.mode}
      data-step-index={state.stepIndex}
    >
      <h1 className="sr-only">{model.project} / Dispatch Lab</h1>
      <div className="lab-commandbar">
        <label className="flow-select"><span>Flow</span>
          <select aria-label="Choose a flow" data-testid="flow-selector" value={flowId} onChange={(event) => chooseFlow(event.target.value)}>
            <option value={ALL_FLOWS}>All flows / overview</option>
            {filteredFlows.map((flow) => <option key={flow.id} value={flow.id}>{flow.label}</option>)}
          </select>
        </label>
        <label className="flow-search"><span className="sr-only">Search flows by name or tag</span>
          <input type="search" value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Find a flow…" aria-label="Search flows by name or tag" />
        </label>
        <div className="view-switch" aria-label="Presentation">
          <button aria-pressed={presentation === "lab"} onClick={() => switchPresentation("lab")}>Lab</button>
          <button aria-pressed={presentation === "diagram"} onClick={() => switchPresentation("diagram")}>Diagram</button>
        </div>
        <details className="agent-purpose">
          <summary>What does {model.project} do?</summary>
          <div><p>{model.summary}</p>{blueprint.tags?.length ? <p className="agent-tags">{blueprint.tags.join(" · ")}</p> : null}{blueprint.stack?.length ? <p><strong>Declared stack:</strong> {blueprint.stack.join(", ")}</p> : null}</div>
        </details>
      </div>

      {filteredFlows.length === 0 && model.flows.length > 0 ? (
        <div className="search-empty" role="status"><span>No matching flows. The overview remains available.</span><button onClick={() => changeSearch("")}>Clear search</button></div>
      ) : null}
      {selectionMessage ? <p className="selection-message" role="status">{selectionMessage}</p> : null}
      {hiddenNodes > 0 || hiddenFlows > 0 ? (
        <div className="visibility-note">
          <span>{hiddenNodes} component{hiddenNodes === 1 ? "" : "s"} restricted{hiddenFlows ? ` · ${hiddenFlows} flow${hiddenFlows === 1 ? "" : "s"} hidden` : ""}</span>
          <a href="/.auth/login/aad?post_login_redirect_uri=/">Sign in for full view ↗</a>
        </div>
      ) : null}

      <div className={`lab-frame${selectedNode ? " inspecting" : ""}`}>
        <div className="lab-viewport">
          {presentation === "lab" ? (
            <DispatchStage
              project={model.project}
              agent={model.agent}
              nodes={nodes}
              flows={flows}
              activeStep={activeStep}
              progress={state.progress}
              motionVisible={state.status !== "idle" && !!activeStep}
              paused={!isPlaying}
              selectedNodeId={selectedNodeId}
              viewMode={viewMode}
              reducedMotion={reducedMotion}
              showContextCaption={false}
              onSelectNode={inspectNode}
            />
          ) : (
            <Suspense fallback={<div className="diagram-loading" role="status">Loading the technical diagram…</div>}>
              <TechnicalDiagram
                key={`${model.project}:${flowId}:${redactPrivate ? "public" : "full"}`}
                blueprint={technicalBlueprint}
                flowId={flowId}
                redactPrivate={redactPrivate}
                onSelectNode={inspectNode}
                animateEdges={false}
              />
            </Suspense>
          )}
          {presentation === "lab" ? (
            <div className="lab-view-controls" aria-label="Illustration viewpoint">
              <button aria-pressed={viewMode === "overview"} onClick={() => setChosenView("overview")}>Whole lab</button>
              <button aria-pressed={viewMode === "follow"} onClick={() => setChosenView("follow")}>Follow handoff</button>
            </div>
          ) : null}
          <span className="illustration-note">Declared architecture · not live execution</span>
        </div>

        {selectedNode ? (
          <aside
            className="component-panel"
            aria-labelledby="component-title"
            data-testid="node-inspector"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeInspector();
              }
            }}
          >
            <div className="panel-heading"><span>Component detail</span><button onClick={closeInspector} aria-label="Close component details">×</button></div>
            <h2 id="component-title" tabIndex={-1} ref={inspectorTitle}>{selectedNode.label}</h2>
            <p className="component-kind">{selectedNode.restricted ? "Private / restricted" : selectedNode.kind}{selectedNode.private && !selectedNode.restricted ? " · private blueprint component" : ""}</p>
            <p>{selectedNode.restricted ? "This component's private details are not shown in the public view." : selectedNode.detail ?? "No additional detail is declared for this component."}</p>
            {selectedNode.restricted ? <a href="/.auth/login/aad?post_login_redirect_uri=/">Sign in for full view ↗</a> : null}
            {selectedNode.resource ? <dl><dt>Declared resource</dt><dd><code className="resource-value">{selectedNode.resource}</code></dd></dl> : null}
            {reference(selectedNode)}
            <h3>Declared connections</h3>
            {connections.length ? (
              <ul className="connection-list">
                {connections.map((step) => {
                  const outgoing = step.from === selectedNode.id;
                  const otherId = outgoing ? step.to : step.from;
                  const otherLabel = outgoing ? step.toLabel : step.fromLabel;
                  return (
                    <li key={step.id}>
                      <span className="connection-context">{step.flowLabel} · handoff {step.index + 1}</span>
                      {otherId === selectedNode.id ? <strong>Returns to this component</strong> : <button onClick={() => inspectNode(otherId)}>{outgoing ? "To" : "From"} {otherLabel} <span aria-hidden="true">↗</span></button>}
                      {step.label ? <span>{step.label}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <p>No handoffs involving this component are visible.</p>}
          </aside>
        ) : null}
      </div>

      <section className="lab-playback" aria-label="Illustrative flow playback">
        <div className="handoff-copy">
          {activeStep ? (
            <>
              <p className="handoff-number">Handoff {state.stepIndex + 1} / {activeFlow?.steps.length} <span>{activeFlow?.label}</span></p>
              <div className="handoff-narration">
                <span className="narration-mark" aria-hidden="true">“</span>
                <p>
                  <button onClick={() => inspectNode(activeStep.from)}>{activeStep.fromLabel}</button>
                  <span> → </span>
                  <button onClick={() => inspectNode(activeStep.to)}>{activeStep.toLabel}</button>
                  <span className="narration-action"> — {activeStep.label?.trim() || "declared relationship"}</span>
                </p>
              </div>
              {activeStep.sourceChanged ? <p className="source-change">This handoff begins at {activeStep.fromLabel}, not at the previous destination.</p> : null}
            </>
          ) : (
            <>
              <h2>{model.flows.length ? "Explore the complete blueprint." : "No public flows are available."}</h2>
              <p>{activeFlow ? "This flow does not declare any handoffs." : model.flows.length ? "Select a mechanism to inspect it, or choose a flow for an illustrated walkthrough." : "Components can still be inspected. Sign in if this agent's flows are private."}</p>
            </>
          )}
        </div>
        <div className="playback-controls">
          <div className="primary-playback">
            <button className="play-flow" data-testid="flow-play" disabled={!canPlay || isPlaying} onClick={startFlow}><span aria-hidden="true">▶</span>{isPlaying ? "Playing walkthrough" : primaryLabel}</button>
            <button data-testid="flow-pause" disabled={!isPlaying} onClick={playback.pause}>Pause</button>
          </div>
          <p className="playback-progress" data-testid="playback-progress" role="status" aria-live="polite">
            {canPlay ? `${state.status === "completed" ? state.mode === "flow" ? "Walkthrough complete" : "Handoff complete" : state.status === "paused" ? "Paused" : isPlaying ? "Playing" : "Ready"} · handoff ${state.stepIndex + 1} of ${activeFlow?.steps.length}` : "Choose a flow to enable playback."}
            {reducedMotion ? " · Reduced motion" : ""}
          </p>
          <div className="step-controls">
            <button disabled={!canPlay || state.stepIndex === 0} onClick={() => moveHandoff("previous")} aria-label="Previous handoff">←</button>
            <button disabled={!canPlay} data-testid="world-start" onClick={() => playHandoff()}>Play one handoff</button>
            <button disabled={!canPlay || state.stepIndex >= (activeFlow?.steps.length ?? 0) - 1} data-testid="flow-step-next" onClick={() => moveHandoff("next")} aria-label="Next handoff">→</button>
            <button disabled={!canPlay} data-testid="world-reset" onClick={playback.reset}>Stop / reset</button>
          </div>
        </div>
      </section>

      <details className="flow-outline">
        <summary>{activeFlow ? `Read the handoff outline · ${activeFlow.steps.length} steps` : `Browse the visible flows · ${model.flows.length}`}</summary>
        {activeFlow ? (
          <ol className="step-outline">
            {activeFlow.steps.map((step) => (
              <li key={step.id}>
                <button aria-current={step.index === state.stepIndex ? "step" : undefined} onClick={() => playHandoff(step.index)}>
                  <span className="outline-index">{step.index + 1}</span>
                  <span><strong>{step.fromLabel} → {step.toLabel}</strong><span>{step.label ?? "Declared relationship"}{step.sourceChanged ? " · Starts from a different component" : ""}</span></span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="overview-flow-list">{model.flows.map((flow) => <li key={flow.id}><button onClick={() => chooseFlow(flow.id)}><strong>{flow.label}</strong><span>{flow.steps.length} declared handoffs{flow.trigger ? ` · ${flow.trigger}` : ""}</span></button></li>)}</ul>
        )}
      </details>
    </main>
  );
}
