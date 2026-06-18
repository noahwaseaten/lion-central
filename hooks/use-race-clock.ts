"use client";

import { useCallback, useEffect, useState } from "react";

interface ClockState {
  /** Wall-clock ms when the current run segment started, or null if paused. */
  startedAtMs: number | null;
  /** Elapsed ms banked from previous run segments. */
  accumulatedMs: number;
  running: boolean;
}

const KEY = "lion-central.clock";
const DEFAULT: ClockState = { startedAtMs: null, accumulatedMs: 0, running: false };

/**
 * Operator-driven race clock, persisted to localStorage. Elapsed is computed
 * during render from timestamps so it stays correct across refreshes and tab
 * throttling; a lightweight ticker only nudges re-renders while running.
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

  const elapsed =
    state.running && state.startedAtMs != null
      ? state.accumulatedMs + Math.max(0, nowMs - state.startedAtMs)
      : state.accumulatedMs;

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
        startedAtMs: s.running ? Date.now() : null,
        accumulatedMs: Math.max(0, ms),
        running: s.running,
      })),
    [],
  );

  return { elapsed, running: state.running, loaded, start, pause, reset, setElapsedMs };
}
