"use client";

import { useCallback, useEffect, useState } from "react";

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
 * Operator-driven race clock, persisted to localStorage. Elapsed is computed
 * during render from timestamps so it stays correct across refreshes and tab
 * throttling; a lightweight ticker only nudges re-renders while running.
 *
 * Supports a pre-race countdown: `startCountdown(ms)` counts down to zero, then
 * auto-continues as a normal count-up elapsed clock from zero — no operator
 * action needed at the moment the race actually starts.
 */
export function useRaceClock() {
  const [state, setState] = useState<ClockState>(DEFAULT);
  const [nowMs, setNowMs] = useState(0);
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, loaded]);

  // Keep other tabs (e.g. /output/clock) in sync with start/pause/reset/set.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        setState({ ...DEFAULT, ...(JSON.parse(e.newValue) as Partial<ClockState>) });
        setNowMs(Date.now());
      } catch {
        // ignore malformed broadcast
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the clock crossing zero, not a derived value */
    setState({ mode: "elapsed", startedAtMs: Date.now(), accumulatedMs: 0, running: true, countdownFromMs: 0 });
  }, [state.mode, state.running, displayMs]);

  const start = useCallback(
    () =>
      setState((s) =>
        s.running ? s : { ...s, running: true, startedAtMs: Date.now() },
      ),
    [],
  );

  const pause = useCallback(
    () =>
      setState((s) =>
        s.running && s.startedAtMs != null
          ? {
              ...s,
              startedAtMs: null,
              accumulatedMs: s.accumulatedMs + (Date.now() - s.startedAtMs),
              running: false,
            }
          : s,
      ),
    [],
  );

  const reset = useCallback(() => setState({ ...DEFAULT }), []);

  const setElapsedMs = useCallback(
    (ms: number) =>
      setState((s) => ({
        mode: "elapsed",
        startedAtMs: s.running ? Date.now() : null,
        accumulatedMs: Math.max(0, ms),
        running: s.running,
        countdownFromMs: 0,
      })),
    [],
  );

  /** Start a pre-race countdown from `ms` down to zero. */
  const startCountdown = useCallback(
    (ms: number) =>
      setState({
        mode: "countdown",
        startedAtMs: Date.now(),
        accumulatedMs: 0,
        running: true,
        countdownFromMs: Math.max(0, ms),
      }),
    [],
  );

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
  };
}
