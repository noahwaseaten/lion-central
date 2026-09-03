"use client";

import { useCallback, useEffect, useReducer } from "react";

export type PanelMode = "library" | "docked";

/** "settled" = at rest. "out" = leaving the old spot. "in" = arriving at the new one. */
export type PanelPhase = "settled" | "out" | "in";

/** Leaving is quick — nothing to read yet. Arriving is slower, so the eye can follow it. */
const OUT_MS = 130;
const IN_MS = 240;

export const PANEL_MOTION_MS = { out: OUT_MS, in: IN_MS };

interface State {
  /** Where the panel is drawn right now. */
  mode: PanelMode;
  /** Where it is heading; equals `mode` at rest. */
  target: PanelMode;
  phase: PanelPhase;
  /** The operator has positioned the panel themselves at least once. */
  steered: boolean;
  /** Bumped per move, so a re-triggered move restarts its timers. */
  seq: number;
}

type Action =
  | { type: "goto"; mode: PanelMode; instant: boolean }
  | { type: "autodock"; instant: boolean }
  | { type: "commit" }
  | { type: "settle" }
  | { type: "reset" };

const INITIAL: State = {
  mode: "library",
  target: "library",
  phase: "settled",
  steered: false,
  seq: 0,
};

function move(state: State, target: PanelMode, instant: boolean): State {
  if (instant) return { ...state, mode: target, target, phase: "settled", seq: state.seq + 1 };
  return { ...state, target, phase: "out", seq: state.seq + 1 };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "goto": {
      const steered = { ...state, steered: true };
      return action.mode === state.target ? steered : move(steered, action.mode, action.instant);
    }
    case "autodock":
      // Once the operator has moved the panel, picking an asset stops moving it
      // for them — the panel should never fight the person using it.
      if (state.steered || state.target === "docked") return state;
      return move(state, "docked", action.instant);
    case "commit":
      return { ...state, mode: state.target, phase: "in" };
    case "settle":
      return state.phase === "in" ? { ...state, phase: "settled" } : state;
    case "reset":
      return INITIAL;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Drives the library's move between its centred and docked positions.
 *
 * The two positions have completely different geometry, and animating between
 * them directly (left/top/width/height) relaid out the whole grid on every
 * frame — which re-rasterised every logo in it, for 400 ms, at a few frames a
 * second. So geometry never animates: the panel fades out, the new geometry is
 * committed in a single invisible layout pass, and it slides back in. Only
 * `transform` and `opacity` are ever in flight, both of which the compositor
 * handles without touching layout.
 */
export function usePanelMode() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // Hold at the old position long enough for the fade-out to finish.
  useEffect(() => {
    if (state.phase !== "out") return;
    const id = window.setTimeout(() => dispatch({ type: "commit" }), OUT_MS);
    return () => window.clearTimeout(id);
  }, [state.phase, state.seq]);

  // Paint one frame at the arrival offset, then release it so the slide-in has
  // somewhere to travel from. Two frames: one to commit, one to start.
  useEffect(() => {
    if (state.phase !== "in") return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => dispatch({ type: "settle" }));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [state.phase, state.seq]);

  return {
    mode: state.mode,
    phase: state.phase,
    /** The operator asked for this position. Sticks until the panel is closed. */
    setModeByUser: useCallback(
      (mode: PanelMode) => dispatch({ type: "goto", mode, instant: prefersReducedMotion() }),
      [],
    ),
    /** Dock after a pick — unless the operator has already positioned the panel. */
    dockAfterPick: useCallback(
      () => dispatch({ type: "autodock", instant: prefersReducedMotion() }),
      [],
    ),
    /** Back to the full centred library, with no leftover preference. */
    reset: useCallback(() => dispatch({ type: "reset" }), []),
  };
}
