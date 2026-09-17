import { describe, expect, it } from "vitest";
import {
  createPlaybackState,
  flowPlaybackReducer,
  PLAYBACK_MOTION_MS,
  PLAYBACK_READING_MS,
  PLAYBACK_STATIC_MS,
} from "./flowPlayback";
import type { FlowPlaybackState, PlaybackControl } from "./flowPlayback";

const publicContext = "project:flow:public";
const privateContext = "project:flow:allowed";
const initial = (stepCount = 3, reducedMotion = false, contextKey = publicContext) =>
  createPlaybackState({ contextKey, stepCount, reducedMotion });
const control = (state: FlowPlaybackState, command: PlaybackControl) =>
  flowPlaybackReducer(state, { type: "control", contextKey: state.contextKey, control: command });
const tick = (state: FlowPlaybackState, elapsedMs: number) =>
  flowPlaybackReducer(state, {
    type: "tick", contextKey: state.contextKey, clockRevision: state.clockRevision, elapsedMs,
  });
const finishStep = (state: FlowPlaybackState) => {
  const reading = state.snapshot.phase === "motion" ? tick(state, PLAYBACK_MOTION_MS) : state;
  return tick(reading, reading.durationMs);
};

describe("flowPlaybackReducer", () => {
  it("starts idle with a caption-free exact public snapshot", () => {
    expect(initial().snapshot).toEqual({
      status: "idle", mode: "flow", phase: "motion", stepIndex: 0, progress: 0,
    });
    expect(Object.keys(initial().snapshot).sort()).toEqual(["mode", "phase", "progress", "status", "stepIndex"]);
  });

  it("plays each full-flow motion and reading phase once, then replays from the beginning", () => {
    let state = control(initial(), { type: "play-flow" });
    for (let index = 0; index < 3; index++) {
      expect(state.snapshot).toEqual({ status: "playing", mode: "flow", phase: "motion", stepIndex: index, progress: 0 });
      state = tick(state, PLAYBACK_MOTION_MS);
      expect(state.snapshot).toEqual({ status: "playing", mode: "flow", phase: "reading", stepIndex: index, progress: 1 });
      state = tick(state, PLAYBACK_READING_MS);
    }
    expect(state.snapshot).toEqual({ status: "completed", mode: "flow", phase: "reading", stepIndex: 2, progress: 1 });
    expect(tick(state, 1_000_000)).toBe(state);
    state = control(state, { type: "play-flow" });
    expect(state.snapshot.stepIndex).toBe(0);
    expect(state.snapshot.status).toBe("playing");
  });

  it("keeps a playing full flow at its current progress on repeated Play", () => {
    const moving = tick(control(initial(), { type: "play-flow" }), 400);
    const repeated = control(moving, { type: "play-flow" });
    expect(repeated.snapshot).toBe(moving.snapshot);
    expect(repeated.elapsedMs).toBe(400);
    expect(repeated.clockRevision).toBeGreaterThan(moving.clockRevision);
  });

  it("holds and resumes the exact mid-motion position", () => {
    let state = tick(control(initial(), { type: "play-flow" }), 640);
    state = control(state, { type: "pause" });
    expect(state.snapshot.status).toBe("paused");
    expect(state.snapshot.progress).toBe(0.4);
    expect(tick(state, 50_000)).toBe(state);
    state = control(state, { type: "play-flow" });
    expect(state.elapsedMs).toBe(640);
    state = tick(state, PLAYBACK_MOTION_MS - 641);
    expect(state.snapshot.phase).toBe("motion");
    state = tick(state, 1);
    expect(state.snapshot.phase).toBe("reading");
    expect(state.elapsedMs).toBe(0);
  });

  it("holds reading time and resumes only the remaining dwell", () => {
    let state = tick(control(initial(), { type: "play-flow" }), PLAYBACK_MOTION_MS);
    state = tick(state, 450);
    state = control(state, { type: "pause" });
    expect(state.snapshot.phase).toBe("reading");
    expect(state.snapshot.progress).toBe(1);
    expect(state.elapsedMs).toBe(450);
    expect(tick(state, 80_000)).toBe(state);
    state = control(state, { type: "play-flow" });
    state = tick(state, PLAYBACK_READING_MS - 451);
    expect(state.snapshot.stepIndex).toBe(0);
    state = tick(state, 1);
    expect(state.snapshot.stepIndex).toBe(1);
    expect(state.snapshot.progress).toBe(0);
  });

  it.each<PlaybackControl>([
    { type: "next" }, { type: "previous" }, { type: "select-step", index: 2 }, { type: "play-step", index: 1 },
  ])("interrupts automatic flow with exactly one $type handoff", (command) => {
    let state = control(initial(), { type: "play-flow" });
    state = finishStep(state);
    state = control(state, command);
    const selected = state.snapshot.stepIndex;
    expect(state.snapshot.mode).toBe("single");
    expect(state.snapshot.status).toBe("playing");
    state = finishStep(state);
    expect(state.snapshot.status).toBe("completed");
    expect(state.snapshot.stepIndex).toBe(selected);
    expect(tick(state, 100_000)).toBe(state);
    expect(control(state, { type: "play-flow" }).snapshot.stepIndex).toBe(0);
  });

  it("resumes a paused single handoff through playStep, but playFlow starts a full flow at zero", () => {
    let state = control(initial(), { type: "play-step", index: 2 });
    state = control(tick(state, 200), { type: "pause" });
    const resumed = control(state, { type: "play-step" });
    expect(resumed.elapsedMs).toBe(200);
    expect(resumed.snapshot.mode).toBe("single");
    expect(resumed.snapshot.stepIndex).toBe(2);
    const full = control(state, { type: "play-flow" });
    expect(full.elapsedMs).toBe(0);
    expect(full.snapshot.mode).toBe("flow");
    expect(full.snapshot.stepIndex).toBe(0);
  });

  it("restarts an explicitly selected handoff and clamps previous/next at valid boundaries", () => {
    let state = control(initial(1), { type: "previous" });
    expect(state.snapshot.stepIndex).toBe(0);
    state = tick(state, 400);
    state = control(state, { type: "select-step", index: 0 });
    expect(state.elapsedMs).toBe(0);
    state = control(finishStep(state), { type: "next" });
    expect(state.snapshot.stepIndex).toBe(0);
    expect(state.snapshot.status).toBe("playing");
    expect(state.snapshot.mode).toBe("single");
  });

  it("does not let a large elapsed tick skip a visible phase or handoff", () => {
    let state = control(initial(), { type: "play-flow" });
    state = tick(state, 1_000_000);
    expect(state.snapshot.phase).toBe("reading");
    expect(state.snapshot.stepIndex).toBe(0);
    expect(state.elapsedMs).toBe(0);
    state = tick(state, 1_000_000);
    expect(state.snapshot.stepIndex).toBe(1);
    expect(state.snapshot.phase).toBe("motion");
    expect(state.snapshot.progress).toBe(0);
    const staticFlow = tick(control(initial(3, true), { type: "play-flow" }), 1_000_000);
    expect(staticFlow.snapshot).toEqual({
      status: "playing", mode: "flow", phase: "reading", stepIndex: 1, progress: 1,
    });
    expect(staticFlow.elapsedMs).toBe(0);
  });

  it("ignores clocks from a previous phase, pause, reset or privacy context", () => {
    const moving = control(initial(3, false, privateContext), { type: "play-flow" });
    const oldTick = { type: "tick", contextKey: moving.contextKey, clockRevision: moving.clockRevision, elapsedMs: 100_000 } as const;
    const reading = tick(moving, PLAYBACK_MOTION_MS);
    expect(flowPlaybackReducer(reading, oldTick)).toBe(reading);
    const paused = control(moving, { type: "pause" });
    const resumed = control(paused, { type: "play-flow" });
    expect(flowPlaybackReducer(resumed, oldTick)).toBe(resumed);
    const reset = control(moving, { type: "reset" });
    expect(flowPlaybackReducer(reset, oldTick)).toBe(reset);
    const publicState = flowPlaybackReducer(moving, {
      type: "configure", configuration: { contextKey: publicContext, stepCount: 1, reducedMotion: false },
    });
    expect(publicState.snapshot).toEqual(initial(1).snapshot);
    expect(flowPlaybackReducer(publicState, oldTick)).toBe(publicState);
    expect(flowPlaybackReducer(publicState, {
      type: "control", contextKey: privateContext, control: { type: "select-step", index: 2 },
    })).toBe(publicState);
    const restoredContext = flowPlaybackReducer(publicState, {
      type: "configure", configuration: { contextKey: privateContext, stepCount: 3, reducedMotion: false },
    });
    expect(flowPlaybackReducer(restoredContext, oldTick)).toBe(restoredContext);
  });

  it("resets a changed step count even if the caller reuses a context key", () => {
    const selected = control(initial(5), { type: "select-step", index: 4 });
    const changed = flowPlaybackReducer(selected, {
      type: "configure", configuration: { contextKey: publicContext, stepCount: 0, reducedMotion: false },
    });
    expect(changed.snapshot).toEqual(initial(0).snapshot);
    expect(changed.stepCount).toBe(0);
  });

  it("uses paced static reading for reduced motion, including Pause/Resume", () => {
    let state = control(initial(2, true), { type: "play-flow" });
    expect(state.snapshot.phase).toBe("reading");
    expect(state.snapshot.progress).toBe(1);
    expect(state.durationMs).toBe(PLAYBACK_STATIC_MS);
    state = control(tick(state, 700), { type: "pause" });
    state = control(state, { type: "play-flow" });
    state = tick(state, PLAYBACK_STATIC_MS - 701);
    expect(state.snapshot.stepIndex).toBe(0);
    state = tick(state, 1);
    expect(state.snapshot.stepIndex).toBe(1);
    expect(state.snapshot.phase).toBe("reading");
    expect(state.snapshot.progress).toBe(1);
    expect(finishStep(state).snapshot.status).toBe("completed");
  });

  it("switches an active motion to a static explanation without resuming a paused state", () => {
    let state = control(tick(control(initial(), { type: "play-flow" }), 400), { type: "pause" });
    state = flowPlaybackReducer(state, {
      type: "configure", configuration: { contextKey: publicContext, stepCount: 3, reducedMotion: true },
    });
    expect(state.snapshot).toEqual({ status: "paused", mode: "flow", phase: "reading", stepIndex: 0, progress: 1 });
    expect(state.durationMs).toBe(PLAYBACK_STATIC_MS);
    state = control(state, { type: "play-flow" });
    state = tick(state, 900);
    const animatedAgain = flowPlaybackReducer(state, {
      type: "configure", configuration: { contextKey: publicContext, stepCount: 3, reducedMotion: false },
    });
    expect(animatedAgain.elapsedMs).toBe(900);
    expect(animatedAgain.durationMs).toBe(PLAYBACK_STATIC_MS);
    expect(finishStep(animatedAgain).snapshot.phase).toBe("motion");
  });

  it("keeps empty flows safely idle for index-free controls", () => {
    let state = initial(0);
    const commands: PlaybackControl[] = [
      { type: "play-flow" }, { type: "play-step" }, { type: "next" }, { type: "previous" },
      { type: "pause" }, { type: "reset" },
    ];
    for (const command of commands) {
      state = control(state, command);
      expect(state.snapshot).toEqual(initial(0).snapshot);
    }
    expect(() => control(state, { type: "select-step", index: 0 })).toThrow(RangeError);
    expect(() => control(state, { type: "play-step", index: 0 })).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid step counts: %s", (count) => {
    expect(() => initial(count)).toThrow(RangeError);
  });

  it.each([-1, 3, 0.5, NaN, Infinity])("rejects invalid step indices: %s", (index) => {
    expect(() => control(initial(), { type: "select-step", index })).toThrow(RangeError);
    expect(() => control(initial(), { type: "play-step", index })).toThrow(RangeError);
  });

  it.each([-1, NaN, Infinity])("rejects invalid elapsed time: %s", (elapsed) => {
    expect(() => tick(control(initial(), { type: "play-flow" }), elapsed)).toThrow(RangeError);
  });

  it("requires a context key and never mutates prior states or snapshots", () => {
    expect(() => initial(1, false, "  ")).toThrow(/contextKey/);
    const state = Object.freeze(control(initial(), { type: "play-flow" }));
    Object.freeze(state.snapshot);
    const before = structuredClone(state);
    tick(state, 200);
    control(state, { type: "pause" });
    control(state, { type: "next" });
    expect(state).toEqual(before);
  });
});
