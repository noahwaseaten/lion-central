"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pushLive, subscribeLive } from "@/lib/live/client";

interface ClockState {
  /** "countdown" ticks down to zero, then auto-flips to "elapsed" at zero. */
  mode: "elapsed" | "countdown";
  /** Wall-clock ms when the current run segment started, or null if paused. */
  startedAtMs: number | null;
  /** Ms banked from previous run segments, within the current mode. */
  accumulatedMs: number;
  running: boolean;
  /** Countdown duration in ms; only meaningful while mode is "countdown". */
  countdownFromMs: number;
}

const KEY = "lion-central.clock";
const DEFAULT: ClockState = {
  mode: "elapsed",
  startedAtMs: null,
  accumulatedMs: 0,
  running: false,
  countdownFromMs: 0,
};

/**
 * Operator-driven race clock, persisted to localStorage and pushed to the
 * server so every connected machine — other tabs, a tunneled `/output/clock`,
 * an OBS browser source — shares one clock. Elapsed is computed during render
 * from timestamps so it stays correct across refreshes and tab throttling; a
 * lightweight ticker only nudges re-renders while running.
 *
 * Supports a pre-race countdown: `startCountdown(ms)` counts down to zero, then
 * auto-continues as a normal count-up elapsed clock from zero — no operator
 * action needed at the moment the race actually starts.
 *
 * Also supports anchoring to an absolute instant: `startAt(epochMs)` runs the
 * clock from a wall-clock moment (a unix timestamp, or a picked day and time),
 * so a gun start nobody was at the keyboard for still yields the correct
 * elapsed time — and a future instant simply sits at zero until it arrives.
 *
 * Pushes to the server happen only from the setters below (a deliberate
 * operator/local action), never from a generic "state changed" effect — that
 * would also fire right after mount hydration, when `state` is still
 * `DEFAULT` on a machine with no local cache, and reset everyone's clock.
 */
export function useRaceClock() {
  const [state, setState] = useState<ClockState>(DEFAULT);
  const [nowMs, setNowMs] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Mirrors `state` for callbacks that need the latest value without depending
  // on it (and without reading/writing state inside a setState updater, which
  // React may invoke twice in dev/StrictMode).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // One-time hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate persisted clock once on mount */
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...DEFAULT, ...(JSON.parse(raw) as Partial<ClockState>) });
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Cache locally whenever state changes (including server-pushed updates), for
  // fast same-tab reloads and as an offline fallback. Never pushes — see setters.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, loaded]);

  // Keep every other client — other tabs, and (via the server) other machines
  // like a tunneled `/output/clock` or an OBS browser source — in sync with
  // start/pause/reset/set.
  useEffect(() => {
    return subscribeLive((live) => {
      if (!live.clock) return;
      setState({ ...DEFAULT, ...(live.clock as Partial<ClockState>) });
      setNowMs(Date.now());
    });
  }, []);

  // Tick only while running; setState lives in the interval callback (allowed).
  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.running]);

  const rawElapsed =
    state.running && state.startedAtMs != null
      ? state.accumulatedMs + Math.max(0, nowMs - state.startedAtMs)
      : state.accumulatedMs;

  // Countdown mode displays time remaining; elapsed mode displays time run.
  const displayMs = state.mode === "countdown" ? Math.max(0, state.countdownFromMs - rawElapsed) : rawElapsed;
  const direction: 1 | -1 = state.mode === "countdown" ? -1 : 1;

  // Countdown hit zero while running — hand off to the count-up race clock at
  // zero, with no operator action needed at the actual start of the race.
  useEffect(() => {
    if (state.mode !== "countdown" || !state.running || displayMs > 0) return;
    const next: ClockState = { mode: "elapsed", startedAtMs: Date.now(), accumulatedMs: 0, running: true, countdownFromMs: 0 };
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the clock crossing zero, not a derived value */
    setState(next);
    void pushLive("clock", next);
  }, [state.mode, state.running, displayMs]);

  const start = useCallback(() => {
    const s = stateRef.current;
    if (s.running) return;
    const next: ClockState = { ...s, running: true, startedAtMs: Date.now() };
    setState(next);
    void pushLive("clock", next);
  }, []);

  const pause = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.startedAtMs == null) return;
    const next: ClockState = {
      ...s,
      startedAtMs: null,
      accumulatedMs: s.accumulatedMs + (Date.now() - s.startedAtMs),
      running: false,
    };
    setState(next);
    void pushLive("clock", next);
  }, []);

  const reset = useCallback(() => {
    const next: ClockState = { ...DEFAULT };
    setState(next);
    void pushLive("clock", next);
  }, []);

  const setElapsedMs = useCallback((ms: number) => {
    const s = stateRef.current;
    const next: ClockState = {
      mode: "elapsed",
      startedAtMs: s.running ? Date.now() : null,
      accumulatedMs: Math.max(0, ms),
      running: s.running,
      countdownFromMs: 0,
    };
    setState(next);
    void pushLive("clock", next);
  }, []);

  /**
   * Run the clock from an absolute instant. Because elapsed is derived from
   * `startedAtMs` against the current time, a past timestamp lands the clock
   * mid-race immediately and a future one holds at zero until it passes — no
   * separate mode needed, and every connected output agrees.
   */
  const startAt = useCallback((epochMs: number) => {
    const next: ClockState = {
      mode: "elapsed",
      startedAtMs: epochMs,
      accumulatedMs: 0,
      running: true,
      countdownFromMs: 0,
    };
    setState(next);
    void pushLive("clock", next);
  }, []);

  /** Start a pre-race countdown from `ms` down to zero. */
  const startCountdown = useCallback((ms: number) => {
    const next: ClockState = {
      mode: "countdown",
      startedAtMs: Date.now(),
      accumulatedMs: 0,
      running: true,
      countdownFromMs: Math.max(0, ms),
    };
    setState(next);
    void pushLive("clock", next);
  }, []);

  return {
    elapsed: displayMs,
    running: state.running,
    mode: state.mode,
    direction,
    loaded,
    start,
    pause,
    reset,
    setElapsedMs,
    startCountdown,
    startAt,
    /** The instant the clock is anchored to while running; null when paused. */
    startedAtMs: state.startedAtMs,
  };
}
