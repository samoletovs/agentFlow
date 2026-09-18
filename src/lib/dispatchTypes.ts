import type { NodeKind } from "./blueprint";

export interface DispatchNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  readonly detail?: string;
  readonly resource?: string;
  readonly url?: string;
  readonly private: boolean;
  readonly restricted: boolean;
}

export interface DispatchStep {
  readonly id: string;
  readonly flowId: string;
  readonly flowLabel: string;
  readonly index: number;
  readonly from: string;
  readonly to: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly label?: string;
  readonly sourceChanged: boolean;
}

export interface DispatchFlow {
  readonly id: string;
  readonly label: string;
  readonly trigger?: string;
  readonly private: boolean;
  readonly steps: readonly DispatchStep[];
}

export interface DispatchModel {
  readonly project: string;
  readonly agent: string;
  readonly summary: string;
  readonly nodes: readonly DispatchNode[];
  readonly flows: readonly DispatchFlow[];
}

export type PlaybackStatus = "idle" | "playing" | "paused" | "completed";
export type PlaybackMode = "flow" | "single";
export type PlaybackPhase = "motion" | "reading";

export interface PlaybackSnapshot {
  readonly status: PlaybackStatus;
  readonly mode: PlaybackMode;
  readonly phase: PlaybackPhase;
  readonly stepIndex: number;
  readonly progress: number;
}

export interface DispatchStageProps {
  readonly project: string;
  readonly agent: string;
  readonly nodes: readonly DispatchNode[];
  readonly flows: readonly DispatchFlow[];
  readonly activeStep: DispatchStep | null;
  readonly progress: number;
  readonly motionVisible: boolean;
  readonly paused: boolean;
  readonly selectedNodeId: string | null;
  readonly viewMode: "overview" | "follow";
  readonly reducedMotion: boolean;
  readonly showContextCaption?: boolean;
  readonly onSelectNode: (nodeId: string) => void;
  readonly onFocusNode?: (nodeId: string) => void;
  readonly focusRequest?: { readonly nodeId: string; readonly requestId: number };
}
