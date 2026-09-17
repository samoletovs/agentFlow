import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import type { DispatchStep } from "../lib/dispatchTypes";
import {
  createPlaybackState,
  flowPlaybackReducer,
  validatePlaybackIndex,
} from "../lib/flowPlayback";
import type { PlaybackConfiguration, PlaybackControl } from "../lib/flowPlayback";

export interface UseFlowPlaybackOptions {
  readonly steps: readonly DispatchStep[];
  /** Change this key whenever the project, selected flow, or privacy/auth scope changes. */
  readonly contextKey: string;
  readonly reducedMotion: boolean;
}

interface PlaybackClock {
  readonly contextKey: string;
  readonly stepCount: number;
  flush: () => void;
  cancel: () => void;
}

export function useFlowPlayback({ steps, contextKey, reducedMotion }: UseFlowPlaybackOptions) {
  const stepCount = steps.length;
  const configuration: PlaybackConfiguration = { contextKey, stepCount, reducedMotion };
  const [playback, dispatch] = useReducer(flowPlaybackReducer, configuration, createPlaybackState);
  const inputs = useRef(configuration);
  const committedPlayback = useRef(playback);
  const clockRef = useRef<PlaybackClock | null>(null);
  const state = playback.contextKey === contextKey && playback.stepCount === stepCount
    ? playback.snapshot
    : createPlaybackState(configuration).snapshot;

  useLayoutEffect(() => {
    committedPlayback.current = playback;
  }, [playback]);

  useLayoutEffect(() => {
    const previous = inputs.current;
    inputs.current = { contextKey, stepCount, reducedMotion };
    if (previous.contextKey === contextKey && previous.stepCount === stepCount &&
        previous.reducedMotion === reducedMotion) return;
    const clock = clockRef.current;
    if (clock) {
      if (previous.contextKey === contextKey && previous.stepCount === stepCount) clock.flush();
      clock.cancel();
    }
    dispatch({ type: "configure", configuration: { contextKey, stepCount, reducedMotion } });
  }, [contextKey, stepCount, reducedMotion]);

  const sendControl = useCallback((control: PlaybackControl) => {
    const scope = inputs.current;
    const clock = clockRef.current;
    if (clock && clock.contextKey === scope.contextKey && clock.stepCount === scope.stepCount) {
      if (control.type === "pause" || control.type === "play-flow") clock.flush();
      clock.cancel();
    }
    dispatch({ type: "control", contextKey: scope.contextKey, control });
    if (typeof document !== "undefined" && document.hidden &&
        control.type !== "pause" && control.type !== "reset") {
      dispatch({ type: "control", contextKey: scope.contextKey, control: { type: "pause" } });
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) sendControl({ type: "pause" });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [sendControl]);

  useEffect(() => {
    const current = committedPlayback.current;
    if (current.contextKey !== contextKey || current.stepCount !== stepCount ||
        current.snapshot.status !== "playing") return;
    if (document.hidden) {
      dispatch({ type: "control", contextKey, control: { type: "pause" } });
      return;
    }

    let active = true;
    let frame: number | undefined;
    let timer: number | undefined;
    let lastTime = performance.now();
    let remaining = current.durationMs - current.elapsedMs;
    const flush = (now = performance.now()) => {
      if (!active) return;
      const elapsedMs = Math.max(0, now - lastTime);
      lastTime = now;
      remaining = Math.max(0, remaining - elapsedMs);
      dispatch({ type: "tick", contextKey, clockRevision: current.clockRevision, elapsedMs });
    };
    const cancel = () => {
      active = false;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
      if (clockRef.current === clock) clockRef.current = null;
    };
    const pauseWhenHidden = () => {
      if (!document.hidden) return false;
      cancel();
      dispatch({ type: "control", contextKey, control: { type: "pause" } });
      return true;
    };
    const onFrame = (now: number) => {
      frame = undefined;
      if (!active || pauseWhenHidden()) return;
      flush(now);
      if (remaining > 0) frame = window.requestAnimationFrame(onFrame);
    };
    const onTimer = () => {
      timer = undefined;
      if (!active || pauseWhenHidden()) return;
      flush();
      if (remaining > 0) timer = window.setTimeout(onTimer, Math.max(1, remaining));
    };
    const clock: PlaybackClock = { contextKey, stepCount, flush, cancel };
    clockRef.current = clock;
    if (current.snapshot.phase === "motion") frame = window.requestAnimationFrame(onFrame);
    else timer = window.setTimeout(onTimer, Math.max(1, remaining));
    return cancel;
  }, [contextKey, stepCount, playback.clockRevision]);

  const playFlow = useCallback(() => sendControl({ type: "play-flow" }), [sendControl]);
  const playStep = useCallback((index?: number) => {
    if (index !== undefined) validatePlaybackIndex(index, inputs.current.stepCount);
    sendControl({ type: "play-step", index });
  }, [sendControl]);
  const pause = useCallback(() => sendControl({ type: "pause" }), [sendControl]);
  const next = useCallback(() => sendControl({ type: "next" }), [sendControl]);
  const previous = useCallback(() => sendControl({ type: "previous" }), [sendControl]);
  const selectStep = useCallback((index: number) => {
    validatePlaybackIndex(index, inputs.current.stepCount);
    sendControl({ type: "select-step", index });
  }, [sendControl]);
  const reset = useCallback(() => sendControl({ type: "reset" }), [sendControl]);

  return { state, playFlow, playStep, pause, next, previous, selectStep, reset };
}
