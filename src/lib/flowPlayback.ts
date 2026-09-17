import type { PlaybackMode, PlaybackSnapshot } from "./dispatchTypes";

export const PLAYBACK_MOTION_MS = 1600;
export const PLAYBACK_READING_MS = 1200;
export const PLAYBACK_STATIC_MS = 2500;

export interface PlaybackConfiguration {
  readonly contextKey: string;
  readonly stepCount: number;
  readonly reducedMotion: boolean;
}

export interface FlowPlaybackState extends PlaybackConfiguration {
  readonly snapshot: PlaybackSnapshot;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly clockRevision: number;
}

export type PlaybackControl =
  | { readonly type: "play-flow" }
  | { readonly type: "play-step"; readonly index?: number }
  | { readonly type: "select-step"; readonly index: number }
  | { readonly type: "pause" }
  | { readonly type: "next" }
  | { readonly type: "previous" }
  | { readonly type: "reset" };

export type PlaybackAction =
  | { readonly type: "configure"; readonly configuration: PlaybackConfiguration }
  | { readonly type: "control"; readonly contextKey: string; readonly control: PlaybackControl }
  | {
      readonly type: "tick";
      readonly contextKey: string;
      readonly clockRevision: number;
      readonly elapsedMs: number;
    };

function validateStepCount(stepCount: number): void {
  if (!Number.isSafeInteger(stepCount) || stepCount < 0) {
    throw new RangeError("Playback step count must be a non-negative safe integer.");
  }
}

function validateConfiguration(configuration: PlaybackConfiguration): void {
  validateStepCount(configuration.stepCount);
  if (!configuration.contextKey.trim()) {
    throw new Error("Playback contextKey must identify the project, flow, and privacy context.");
  }
}

export function validatePlaybackIndex(index: number, stepCount: number): void {
  validateStepCount(stepCount);
  if (!Number.isSafeInteger(index) || index < 0 || index >= stepCount) {
    throw new RangeError("Playback step index is outside the current flow.");
  }
}

export function createPlaybackState(configuration: PlaybackConfiguration): FlowPlaybackState {
  validateConfiguration(configuration);
  return {
    contextKey: configuration.contextKey,
    stepCount: configuration.stepCount,
    reducedMotion: configuration.reducedMotion,
    snapshot: { status: "idle", mode: "flow", phase: "motion", stepIndex: 0, progress: 0 },
    elapsedMs: 0,
    durationMs: PLAYBACK_MOTION_MS,
    clockRevision: 0,
  };
}

function startStep(state: FlowPlaybackState, index: number, mode: PlaybackMode): FlowPlaybackState {
  validatePlaybackIndex(index, state.stepCount);
  return {
    ...state,
    snapshot: {
      status: "playing",
      mode,
      phase: state.reducedMotion ? "reading" : "motion",
      stepIndex: index,
      progress: state.reducedMotion ? 1 : 0,
    },
    elapsedMs: 0,
    durationMs: state.reducedMotion ? PLAYBACK_STATIC_MS : PLAYBACK_MOTION_MS,
  };
}

function reduceControl(state: FlowPlaybackState, control: PlaybackControl): FlowPlaybackState {
  const snapshot = state.snapshot;
  switch (control.type) {
    case "reset":
      return createPlaybackState(state);
    case "pause":
      return snapshot.status === "playing"
        ? { ...state, snapshot: { ...snapshot, status: "paused" } }
        : state;
    case "play-flow":
      if (state.stepCount === 0) return state;
      if (snapshot.mode === "flow" && snapshot.status === "playing") return state;
      if (snapshot.mode === "flow" && snapshot.status === "paused") {
        return { ...state, snapshot: { ...snapshot, status: "playing" } };
      }
      return startStep(state, 0, "flow");
    case "play-step": {
      if (control.index !== undefined) validatePlaybackIndex(control.index, state.stepCount);
      if (state.stepCount === 0) return state;
      const index = control.index ?? snapshot.stepIndex;
      if (snapshot.mode === "single" && snapshot.status === "paused" && index === snapshot.stepIndex) {
        return { ...state, snapshot: { ...snapshot, status: "playing" } };
      }
      return startStep(state, index, "single");
    }
    case "select-step":
      return startStep(state, control.index, "single");
    case "next":
      return state.stepCount === 0
        ? state
        : startStep(state, Math.min(snapshot.stepIndex + 1, state.stepCount - 1), "single");
    case "previous":
      return state.stepCount === 0
        ? state
        : startStep(state, Math.max(snapshot.stepIndex - 1, 0), "single");
    default:
      throw new Error("Unknown playback control.");
  }
}

function advanceClock(state: FlowPlaybackState, elapsedMs: number): FlowPlaybackState {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError("Playback elapsed time must be finite and non-negative.");
  }
  if (state.snapshot.status !== "playing" || elapsedMs === 0) return state;
  const elapsed = Math.min(state.durationMs, state.elapsedMs + elapsedMs);
  if (elapsed < state.durationMs) {
    return {
      ...state,
      elapsedMs: elapsed,
      snapshot: {
        ...state.snapshot,
        progress: state.snapshot.phase === "reading" ? 1 : elapsed / state.durationMs,
      },
    };
  }

  // Excess elapsed time cannot consume an unseen phase or another handoff.
  const clockRevision = state.clockRevision + 1;
  if (state.snapshot.phase === "motion") {
    return {
      ...state,
      snapshot: { ...state.snapshot, phase: "reading", progress: 1 },
      elapsedMs: 0,
      durationMs: PLAYBACK_READING_MS,
      clockRevision,
    };
  }
  if (state.snapshot.mode === "flow" && state.snapshot.stepIndex < state.stepCount - 1) {
    return { ...startStep(state, state.snapshot.stepIndex + 1, "flow"), clockRevision };
  }
  return {
    ...state,
    snapshot: { ...state.snapshot, status: "completed", progress: 1 },
    elapsedMs: state.durationMs,
    clockRevision,
  };
}

export function flowPlaybackReducer(state: FlowPlaybackState, action: PlaybackAction): FlowPlaybackState {
  if (action.type === "configure") {
    const configuration = action.configuration;
    validateConfiguration(configuration);
    if (configuration.contextKey !== state.contextKey || configuration.stepCount !== state.stepCount) {
      return { ...createPlaybackState(configuration), clockRevision: state.clockRevision + 1 };
    }
    if (configuration.reducedMotion === state.reducedMotion) return state;
    if (configuration.reducedMotion && state.snapshot.phase === "motion" &&
        (state.snapshot.status === "playing" || state.snapshot.status === "paused")) {
      return {
        ...state,
        reducedMotion: true,
        snapshot: { ...state.snapshot, phase: "reading", progress: 1 },
        elapsedMs: 0,
        durationMs: PLAYBACK_STATIC_MS,
        clockRevision: state.clockRevision + 1,
      };
    }
    return { ...state, reducedMotion: configuration.reducedMotion, clockRevision: state.clockRevision + 1 };
  }
  if (action.contextKey !== state.contextKey) return state;
  if (action.type === "tick") {
    if (action.clockRevision !== state.clockRevision) return state;
    return advanceClock(state, action.elapsedMs);
  }
  return { ...reduceControl(state, action.control), clockRevision: state.clockRevision + 1 };
}
