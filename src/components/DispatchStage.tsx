import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DispatchStageProps } from "../lib/dispatchTypes";
import {
  createDispatchLabelMeasurer,
  dispatchCurve,
  dispatchCurvePath,
  dispatchDestinationCue,
  dispatchFocusPoint,
  dispatchFollowView,
  dispatchNodeLabel,
  dispatchPlaybackPose,
  layoutDispatchRoom,
  pointOnDispatchCurve,
  resolveDispatchStep,
  type DispatchLayout,
} from "../lib/dispatchLayout";
import { LabMachine } from "./LabMachine";
import "./dispatch-stage.css";

interface DispatchRoomProps {
  readonly layout: DispatchLayout;
  readonly project: string;
  readonly hatchId: string;
  readonly toneId: string;
}

const DispatchRoom = memo(function DispatchRoom({
  layout,
  project,
  hatchId,
  toneId,
}: DispatchRoomProps) {
  const { width, height, rows, placements } = layout;
  const signX = width / 2 - 225;
  const projectCharacters = Array.from(project);
  const roomTitle = projectCharacters.length > 19
    ? `${projectCharacters.slice(0, 18).join("")}…`
    : project;

  return (
    <g aria-hidden="true" className="dispatch-stage__room">
      <path d={`M0 0H${width}V${height}H0Z`} className="dispatch-stage__room-field" />
      <path d={`M28 30 ${width - 215} 15l187 63V${height - 36}H28Z`} className="dispatch-stage__wall dl-ink" />
      <path d={`m${width - 215} 15 187 63v${height - 114}l-187-28Z`} className="dl-alloy" />
      <path d={`M28 30 ${width - 215} 15l187 63-17 24-170-52L28 61Z`} className="dl-carbon" />
      <path d={`m32 93 20-2v${height - 127}H32Zm${width - 73} 18 28 11v${height - 158}h-28Z`} className="dl-cel" />
      <path d={`m65 68 ${Math.max(60, signX - 100)}-8v20L65 91Z`} className="dl-steel" />
      <path d={`M${signX} 25h451l-14 67H${signX}Z`} className="dl-paper" />
      <path d={`M${signX} 25h9v67h-9Z`} className="dl-signal" />
      <text x={signX + 23} y="68" className="dispatch-stage__project">{roomTitle}</text>
      <text x={signX + 25} y="88" className="dispatch-stage__room-label">DISPATCH LAB / DECLARATIVE ARCHITECTURE</text>
      {Array.from({ length: Math.max(1, rows) }, (_, row) => {
        const center = placements.find((placement) => placement.row === row)?.y ?? 280;
        const floor = center + 124;
        return (
          <g key={row}>
            <path d={`M52 ${floor}H${width - 53}v66H52Z`} className="dl-alloy" />
            <path d={`M52 ${floor}H${width - 53}v13H52Z`} className="dl-carbon" />
            <path d={`m${width - 218} ${floor + 13} 164 0v51h-106Z`} className="dl-shadow" />
            <path d={`m65 ${floor + 53} ${width - 135} 0`} className="dl-line dispatch-stage__construction" />
            <path d={`M${width - 213} ${center - 110}h145v200h-145Z`} fill={`url(#${hatchId})`} />
            <path d={`M${width / 2 - 70} ${center - 115}h155l-68 145h-87Z`} fill={`url(#${toneId})`} />
            <path d={`M70 ${center - 105}h95v42H70Z`} className="dispatch-stage__vent" />
            <path d={`m80 ${center - 95}h72m-72 10h72m-72 10h72`} className="dl-line dispatch-stage__construction" />
            {placements.filter((placement) => placement.row === row).map((placement) => (
              <g key={placement.node.id}>
                <path d={`m${placement.x - 94} ${floor + 13} 20 20 23-20m91 0 20 20 18-20`} className="dl-line" />
                <path d={`m${placement.x - 115} ${floor + 63} 10 3m204-3 10 3`} className="dl-line dispatch-stage__construction" />
              </g>
            ))}
          </g>
        );
      })}
      <path d={`M28 ${height - 37}H${width - 28}l28 37H0Z`} className="dl-shadow dl-ink" />
      <path d={`m${width - 134} ${height - 29}-12 18h25l12-18m-54 0-12 18h25l12-18`} className="dl-signal" />
    </g>
  );
});

export function DispatchStage({
  project,
  agent,
  nodes,
  flows,
  activeStep,
  progress,
  motionVisible,
  paused,
  selectedNodeId,
  viewMode,
  reducedMotion,
  showContextCaption = true,
  onSelectNode,
  onFocusNode,
  focusRequest,
}: DispatchStageProps) {
  const instance = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    title: `dispatch-${instance}-title`,
    description: `dispatch-${instance}-description`,
    hatch: `dispatch-${instance}-hatch`,
    tone: `dispatch-${instance}-tone`,
    arrow: `dispatch-${instance}-arrow`,
  };
  const root = useRef<HTMLDivElement>(null);
  const machines = useRef(new Map<string, SVGGElement>());
  const restoringFocus = useRef(false);
  const lastFocusRequest = useRef<DispatchStageProps["focusRequest"]>(undefined);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const measureLabel = useMemo(() => createDispatchLabelMeasurer(), []);
  const layout = useMemo(() => layoutDispatchRoom(nodes, flows, measureLabel), [nodes, flows, measureLabel]);
  const step = useMemo(() => resolveDispatchStep(flows, activeStep), [flows, activeStep]);
  const currentCurve = useMemo(
    () => step ? dispatchCurve(layout, step.from, step.to) : null,
    [layout, step],
  );
  const paths = useMemo(() => layout.connections.flatMap((connection) => {
    const curve = dispatchCurve(layout, connection.from, connection.to);
    return curve ? [{
      key: JSON.stringify([connection.from, connection.to]),
      path: dispatchCurvePath(curve),
    }] : [];
  }), [layout]);

  const registerMachine = useCallback((nodeId: string, element: SVGGElement | null) => {
    if (element) machines.current.set(nodeId, element);
    else {
      machines.current.delete(nodeId);
      setFocusedNodeId((current) => current === nodeId ? null : current);
    }
  }, []);
  const focusMachine = useCallback((nodeId: string, focusVisible: boolean) => {
    if (!focusVisible || restoringFocus.current) return;
    setFocusedNodeId(nodeId);
    onFocusNode?.(nodeId);
  }, [onFocusNode]);
  const blurMachine = useCallback((nodeId: string) => {
    setFocusedNodeId((current) => current === nodeId ? null : current);
  }, []);

  useLayoutEffect(() => {
    if (!focusRequest ||
      (lastFocusRequest.current?.nodeId === focusRequest.nodeId &&
        lastFocusRequest.current.requestId === focusRequest.requestId)) return;
    lastFocusRequest.current = focusRequest;
    const element = machines.current.get(focusRequest.nodeId);
    if (!element) return;
    restoringFocus.current = true;
    element.focus({ preventScroll: true });
    restoringFocus.current = false;
    if (document.activeElement === element) focusMachine(focusRequest.nodeId, true);
  }, [focusRequest, focusMachine]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setViewport((previous) => previous.width === width && previous.height === height
        ? previous
        : { width, height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pose = dispatchPlaybackPose(progress, motionVisible, reducedMotion);
  const selected = selectedNodeId ? layout.byId.get(selectedNodeId) : undefined;
  const source = step && currentCurve ? layout.byId.get(step.from) : undefined;
  const destination = step && currentCurve ? layout.byId.get(step.to) : undefined;
  const courier = currentCurve ? pointOnDispatchCurve(currentCurve, pose.travel) : null;
  const nextPoint = currentCurve
    ? pointOnDispatchCurve(currentCurve, Math.min(1, pose.travel + 0.002))
    : null;
  const angle = courier && nextPoint
    ? Math.max(-12, Math.min(12, Math.atan2(nextPoint.y - courier.y, nextPoint.x - courier.x) * 180 / Math.PI))
    : 0;
  const focusPoint = dispatchFocusPoint(layout, {
    activeStep: step, selectedNodeId, progress: pose.progress, motionVisible, paused, reducedMotion,
  }, courier, focusedNodeId);
  const view = viewMode === "follow"
    ? dispatchFollowView(layout, focusPoint, viewport.width / viewport.height)
    : { x: 0, y: 0, width: layout.width, height: layout.height };
  const unavailable = activeStep !== null && (!step || !currentCurve);
  const invalidProgress = !Number.isFinite(progress);
  const hasNotice = nodes.length === 0 || unavailable || layout.unavailableConnections > 0 || invalidProgress;
  const relationshipLabel = source && destination
    ? `${dispatchNodeLabel(source.node)} → ${dispatchNodeLabel(destination.node)}`
    : null;
  const destinationCue = viewMode === "follow" && destination
    ? dispatchDestinationCue(layout, destination.node.id, view)
    : null;
  const cueArrows = { left: "←", right: "→", top: "↑", bottom: "↓" };
  const cueStyle = destinationCue?.edge === "left" || destinationCue?.edge === "right"
    ? { top: Math.max(Math.min(88, viewport.height / 2), Math.min(viewport.height - Math.min(108, viewport.height / 2), viewport.height * destinationCue.offset)) }
    : destinationCue
      ? { left: Math.max(Math.min(120, viewport.width / 2), Math.min(viewport.width - Math.min(120, viewport.width / 2), viewport.width * destinationCue.offset)) }
      : undefined;

  return (
    <div
      ref={root}
      className="dispatch-stage"
      data-testid="dispatch-stage"
      data-view={viewMode}
      data-paused={paused}
      data-reduced-motion={reducedMotion}
      data-step-index={step?.index}
      aria-label={`${project}: ${agent}, illustrated architecture`}
    >
      <svg
        className="dispatch-stage__scene"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-labelledby={ids.title}
        aria-describedby={ids.description}
      >
        <title id={ids.title}>{project} — Dispatch Lab</title>
        <desc id={ids.description}>
          Components are grouped into illustrated room bays by role, not execution order.
          Only arrows represent declared handoffs. Select a machine with Enter, Space, or a pointer to inspect it.
          This illustration is not live execution.
        </desc>
        <defs>
          <pattern id={ids.hatch} width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="m0 12 12-12" className="dispatch-stage__hatch" />
          </pattern>
          <pattern id={ids.tone} width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" className="dispatch-stage__tone" />
          </pattern>
          <marker id={ids.arrow} markerWidth="11" markerHeight="11" refX="14" refY="5" orient="auto" markerUnits="userSpaceOnUse" viewBox="0 0 10 10">
            <path d="m1 1 7 4-7 4" className="dispatch-stage__arrow" />
          </marker>
        </defs>
        <DispatchRoom layout={layout} project={project} hatchId={ids.hatch} toneId={ids.tone} />
        <g aria-hidden="true" className="dispatch-stage__connections">
          {paths.map((path) => <path key={path.key} d={path.path} className="dispatch-stage__connection" data-testid="dispatch-connection" markerEnd={`url(#${ids.arrow})`} />)}
        </g>
        {layout.placements.map((placement) => (
          <LabMachine
            key={placement.node.id}
            placement={placement}
            selected={placement.node.id === selectedNodeId}
            source={placement.node.id === source?.node.id}
            destination={placement.node.id === destination?.node.id}
            senderPose={placement.node.id === source?.node.id ? pose.sender : 0}
            receiverPose={placement.node.id === destination?.node.id ? pose.receiver : 0}
            onSelectNode={onSelectNode}
            keyboardFocused={placement.node.id === focusedNodeId}
            registerMachine={registerMachine}
            onFocusMachine={focusMachine}
            onBlurMachine={blurMachine}
          />
        ))}
        {currentCurve && (
          <g aria-hidden="true" className="dispatch-stage__active-connection">
            <path d={dispatchCurvePath(currentCurve)} className="dispatch-stage__route-under" />
            <path d={dispatchCurvePath(currentCurve)} className="dispatch-stage__route" markerEnd={`url(#${ids.arrow})`} data-testid="dispatch-active-path" />
          </g>
        )}
        {courier && pose.courierVisible && (
          <g
            aria-hidden="true"
            className="dispatch-stage__courier"
            data-testid="dispatch-courier"
            transform={`translate(${courier.x} ${courier.y}) rotate(${angle})`}
          >
            <path d="m-31-9-14 0m14 9h-21m21 9h-12" className="dispatch-stage__courier-trail" />
            <path d="M-26-17H18l9 8v26h-53Z" className="dl-paper dl-ink" />
            <path d="m-24-14 25 16 20-13m-43 26 15-14m29 14-17-14" className="dl-line dl-fine" />
            <path d="M15-9h9v12h-9Z" className="dl-signal" />
            <path d="m-17 9 15 0" className="dl-line dl-fine" />
          </g>
        )}
      </svg>
      {destinationCue && (
        <button
          className="dispatch-stage__destination-cue"
          data-testid="dispatch-destination-cue"
          data-edge={destinationCue.edge}
          style={cueStyle}
          onClick={() => onSelectNode(destinationCue.nodeId)}
          aria-label={`Inspect destination ${destinationCue.label}`}
        >
          <span aria-hidden="true">{cueArrows[destinationCue.edge]}</span>
          <span>To <strong>{destinationCue.label}</strong></span>
        </button>
      )}
      {(hasNotice || showContextCaption) && <div className="dispatch-stage__caption">
        {nodes.length === 0 ? (
          <p role="status">No components are available in this view.</p>
        ) : unavailable || layout.unavailableConnections > 0 ? (
          <p role="status">Some handoffs reference components unavailable in this view.</p>
        ) : invalidProgress ? (
          <p role="alert">The playback position is unavailable. The declared architecture remains visible.</p>
        ) : (
          <>
            <p className="dispatch-stage__context">
              {selected ? dispatchNodeLabel(selected.node) : relationshipLabel ?? "Select a machine to inspect its role and connections."}
            </p>
            <p className="dispatch-stage__note">Placement is schematic. Arrows are declared handoffs, not live activity.</p>
          </>
        )}
      </div>}
    </div>
  );
}
