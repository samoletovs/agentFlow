import type { NodeKind } from "./blueprint";
import type { DispatchFlow, DispatchNode, DispatchStageProps, DispatchStep } from "./dispatchTypes";

export interface DispatchPoint {
  readonly x: number;
  readonly y: number;
}

export interface DispatchBounds extends DispatchPoint {
  readonly width: number;
  readonly height: number;
}

export type DispatchMechanism = NodeKind | "restricted" | "weather" | "observatory";

export interface DispatchMechanismSpec {
  readonly scale: number;
  readonly offsetY: number;
  readonly port: DispatchPoint;
}

export interface DispatchPlacement extends DispatchPoint {
  readonly node: DispatchNode;
  readonly index: number;
  readonly row: number;
  readonly column: number;
  readonly mechanism: DispatchMechanism;
  readonly spec: DispatchMechanismSpec;
  readonly port: DispatchPoint;
  readonly coreBounds: DispatchBounds;
  readonly labelLines: readonly string[];
}

export interface DispatchConnection {
  readonly from: string;
  readonly to: string;
  readonly occurrences: readonly DispatchStep[];
}

export interface DispatchLayout {
  readonly width: number;
  readonly height: number;
  readonly rows: number;
  readonly placements: readonly DispatchPlacement[];
  readonly byId: ReadonlyMap<string, DispatchPlacement>;
  readonly connections: readonly DispatchConnection[];
  readonly unavailableConnections: number;
}

export type DispatchCurve = readonly [
  DispatchPoint,
  DispatchPoint,
  DispatchPoint,
  DispatchPoint,
];

export interface DispatchPlaybackPose {
  readonly progress: number;
  readonly travel: number;
  readonly sender: number;
  readonly receiver: number;
  readonly courierVisible: boolean;
}

export interface DispatchDestinationCue {
  readonly nodeId: string;
  readonly label: string;
  readonly edge: "left" | "right" | "top" | "bottom";
  readonly offset: number;
}

const COLUMN_PITCH = 292;
const ROW_PITCH = 318;
const ROLE_ORDER: Record<NodeKind, number> = {
  channel: 0,
  trigger: 1,
  pwa: 2,
  repo: 3,
  job: 4,
  compute: 5,
  agent: 6,
  tool: 7,
  data: 8,
  secret: 9,
};

function spec(
  scale: number,
  footY: number,
  portX: number,
  portY: number,
): DispatchMechanismSpec {
  return {
    scale,
    offsetY: 110 - footY * scale,
    port: { x: portX * scale, y: portY * scale + 110 - footY * scale },
  };
}

const MECHANISMS: Record<DispatchMechanism, DispatchMechanismSpec> = {
  channel: spec(0.9, 85, 2, 15),
  trigger: spec(0.86, 95, 15, 38),
  compute: spec(0.64, 152, 25, -27),
  agent: spec(0.52, 203, 65, -21),
  tool: spec(0.86, 92, 36, 1),
  weather: spec(0.78, 109, -14, -43),
  observatory: spec(0.84, 96, 32, -23),
  data: spec(0.94, 110, 2, -6),
  secret: spec(0.97, 70, 4, -56),
  restricted: spec(0.97, 87, -1, -28),
  job: spec(0.94, 110, 20, -24),
  repo: spec(0.94, 110, -8, -10),
  pwa: spec(0.94, 110, 10, -24),
};

export function dispatchNodeLabel(node: DispatchNode): string {
  return node.restricted ? "Restricted component" : node.label;
}

export function dispatchMechanism(node: DispatchNode): DispatchMechanism {
  if (node.restricted) return "restricted";
  if (node.kind === "tool" && /weather|forecast/i.test(node.label)) return "weather";
  if (node.kind === "data" && /insights|telemetry|tracing|observability/i.test(node.label)) {
    return "observatory";
  }
  return node.kind;
}

export function wrapDispatchLabel(label: string, limit = 25): readonly string[] {
  const characters = Array.from(label.replace(/\s+/g, " ").trim());
  if (characters.length <= limit) return [characters.join("")];
  let split = limit;
  for (let index = limit; index >= Math.floor(limit * 0.55); index -= 1) {
    if ([" ", "_", "-", "/"].includes(characters[index - 1])) {
      split = index;
      break;
    }
  }
  const remainder = characters.slice(split).join("").trim();
  return [
    characters.slice(0, split).join("").trim(),
    Array.from(remainder).length > limit
      ? `${Array.from(remainder).slice(0, limit - 1).join("")}…`
      : remainder,
  ];
}

export function layoutDispatchRoom(
  nodes: readonly DispatchNode[],
  flows: readonly DispatchFlow[],
): DispatchLayout {
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) {
    throw new Error("Dispatch Lab requires unique component identifiers.");
  }
  const columns = Math.min(nodes.length, Math.ceil(Math.sqrt(nodes.length * 1.9)));
  const rows = columns ? Math.ceil(nodes.length / columns) : 0;
  const width = Math.max(900, columns * COLUMN_PITCH + 96);
  const height = Math.max(640, rows * ROW_PITCH + 144);
  const ordered = nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const aRole = a.node.restricted ? 10 : ROLE_ORDER[a.node.kind];
      const bRole = b.node.restricted ? 10 : ROLE_ORDER[b.node.kind];
      return aRole - bRole || a.index - b.index;
    });

  // Room bays group roles, not execution order. Only declared steps create arrows.
  const placements = ordered.map(({ node }, index): DispatchPlacement => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = (width - columns * COLUMN_PITCH) / 2 + column * COLUMN_PITCH + COLUMN_PITCH / 2;
    const y = rows === 1 ? 280 : 212 + row * ROW_PITCH;
    const mechanism = dispatchMechanism(node);
    const machine = MECHANISMS[mechanism];
    return {
      node,
      index,
      row,
      column,
      x,
      y,
      mechanism,
      spec: machine,
      port: { x: x + machine.port.x, y: y + machine.port.y },
      coreBounds: { x: x - 122, y: y - 124, width: 244, height: 248 },
      labelLines: wrapDispatchLabel(dispatchNodeLabel(node)),
    };
  });
  const byId = new Map(placements.map((placement) => [placement.node.id, placement]));
  const connections = new Map<string, { from: string; to: string; occurrences: DispatchStep[] }>();
  let unavailableConnections = 0;
  for (const flow of flows) {
    for (const step of flow.steps) {
      if (!ids.has(step.from) || !ids.has(step.to)) {
        unavailableConnections += 1;
        continue;
      }
      const key = JSON.stringify([step.from, step.to]);
      const connection = connections.get(key);
      if (connection) connection.occurrences.push(step);
      else connections.set(key, { from: step.from, to: step.to, occurrences: [step] });
    }
  }
  return {
    width,
    height,
    rows,
    placements,
    byId,
    connections: [...connections.values()],
    unavailableConnections,
  };
}

export function resolveDispatchStep(
  flows: readonly DispatchFlow[],
  activeStep: DispatchStep | null,
): DispatchStep | null {
  if (!activeStep) return null;
  const flow = flows.find((item) => item.id === activeStep.flowId);
  return flow?.steps.find((step) =>
    step.id === activeStep.id &&
    step.index === activeStep.index &&
    step.from === activeStep.from &&
    step.to === activeStep.to,
  ) ?? null;
}

export function dispatchCurve(
  layout: DispatchLayout,
  fromId: string,
  toId: string,
): DispatchCurve | null {
  const from = layout.byId.get(fromId);
  const to = layout.byId.get(toId);
  if (!from || !to || !layout.connections.some((connection) => connection.from === fromId && connection.to === toId)) return null;
  const a = from.port;
  const b = to.port;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lane = (from.index + to.index) % 3;
  let handles: readonly [DispatchPoint, DispatchPoint];
  if (fromId === toId) {
    handles = [{ x: a.x - 145, y: a.y - 205 }, { x: a.x + 145, y: a.y - 205 }];
  } else if (from.row === to.row) {
    const bend = (dx > 0 ? -1 : 1) * (Math.abs(dx) > COLUMN_PITCH * 1.5 ? 205 : 80 + lane * 18);
    handles = [{ x: a.x + dx * 0.3, y: a.y + bend }, { x: b.x - dx * 0.3, y: b.y + bend }];
  } else if (Math.abs(dx) < 75) {
    const bend = (from.index < to.index ? 1 : -1) * (150 + lane * 16);
    handles = [{ x: a.x + bend, y: a.y + dy * 0.2 }, { x: b.x + bend, y: b.y - dy * 0.2 }];
  } else {
    const bend = from.index < to.index ? -60 : 60;
    handles = [{ x: a.x + dx * 0.38, y: a.y + bend }, { x: b.x - dx * 0.38, y: b.y + bend }];
  }
  const contained = (point: DispatchPoint): DispatchPoint => ({
    x: Math.max(8, Math.min(layout.width - 8, point.x)),
    y: Math.max(8, Math.min(layout.height - 8, point.y)),
  });
  return [a, contained(handles[0]), contained(handles[1]), b];
}

export function dispatchCurvePath(curve: DispatchCurve): string {
  const [a, b, c, d] = curve;
  return `M ${a.x} ${a.y} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`;
}

export function pointOnDispatchCurve(curve: DispatchCurve, progress: number): DispatchPoint {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const s = 1 - t;
  const weights = [s ** 3, 3 * s ** 2 * t, 3 * s * t ** 2, t ** 3];
  return {
    x: curve.reduce((sum, point, index) => sum + point.x * weights[index], 0),
    y: curve.reduce((sum, point, index) => sum + point.y * weights[index], 0),
  };
}

export function dispatchPlaybackPose(
  progress: number,
  motionVisible: boolean,
  reducedMotion: boolean,
): DispatchPlaybackPose {
  const finite = Number.isFinite(progress);
  const p = finite ? Math.max(0, Math.min(1, progress)) : 0;
  const active = motionVisible && !reducedMotion && finite;
  const travel = Math.max(0, Math.min(1, (p - 0.15) / 0.65));
  return {
    progress: p,
    travel: travel * travel * (3 - 2 * travel),
    sender: active && p < 0.15 ? Math.sin(Math.PI * p / 0.15) : 0,
    receiver: active && p > 0.8 ? Math.sin(Math.PI * (p - 0.8) / 0.2) : 0,
    courierVisible: active && p >= 0.15 && p <= 0.8,
  };
}

export function dispatchFollowView(
  layout: DispatchLayout,
  point: DispatchPoint,
  aspectRatio: number,
): DispatchBounds {
  const aspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const height = Math.min(layout.height, aspect < 1 ? 620 : 660);
  const width = Math.min(layout.width, height * aspect);
  return {
    x: Math.max(0, Math.min(layout.width - width, point.x - width / 2)),
    y: Math.max(0, Math.min(layout.height - height, point.y - height / 2)),
    width,
    height,
  };
}

export function dispatchFocusPoint(
  layout: DispatchLayout,
  options: Pick<DispatchStageProps, "activeStep" | "selectedNodeId" | "progress" | "motionVisible" | "paused" | "reducedMotion">,
  courier: DispatchPoint | null,
): DispatchPoint {
  const selected = options.selectedNodeId ? layout.byId.get(options.selectedNodeId)?.port : undefined;
  const source = options.activeStep ? layout.byId.get(options.activeStep.from)?.port : undefined;
  const destination = options.activeStep ? layout.byId.get(options.activeStep.to)?.port : undefined;
  const fallback = source ??
    layout.placements.find((placement) => placement.node.kind === "agent" && !placement.node.restricted)?.port ??
    layout.placements[0]?.port ??
    { x: layout.width / 2, y: layout.height / 2 };
  if (options.motionVisible && (!options.paused || !selected)) {
    return (options.reducedMotion ? destination : courier) ?? destination ?? fallback;
  }
  return selected ?? (options.progress >= 0.8 ? destination : source) ?? fallback;
}

export function dispatchDestinationCue(
  layout: DispatchLayout,
  destinationId: string,
  view: DispatchBounds,
): DispatchDestinationCue | null {
  if (![view.x, view.y, view.width, view.height].every(Number.isFinite) || view.width <= 0 || view.height <= 0) {
    throw new RangeError("A destination cue requires finite, positive view bounds.");
  }
  const destination = layout.byId.get(destinationId);
  if (!destination) return null;
  const x = (destination.port.x - view.x) / view.width;
  const y = (destination.port.y - view.y) / view.height;
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) return null;
  const dx = x - 0.5;
  const dy = y - 0.5;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const reach = 0.5 / (horizontal ? Math.abs(dx) : Math.abs(dy));
  return {
    nodeId: destination.node.id,
    label: dispatchNodeLabel(destination.node),
    edge: horizontal ? (dx < 0 ? "left" : "right") : (dy < 0 ? "top" : "bottom"),
    offset: Math.max(0.15, Math.min(0.85, 0.5 + (horizontal ? dy : dx) * reach)),
  };
}
