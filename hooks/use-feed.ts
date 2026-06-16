"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { inferSplit } from "@/lib/feed/splits";
import type {
  ConnectionStatus,
  FeedEntry,
  FeedSnapshot,
  SplitThresholds,
} from "@/lib/feed/types";

interface UseFeedParams {
  file: string | null;
  thresholds: SplitThresholds;
  pollingMs: number;
  useFallbackAlways: boolean;
  online: boolean;
}

/** Delay before SSE connection trouble escalates to polling. */
const FALLBACK_DELAY_MS = 4000;

/**
 * Orchestrates the live feed: opens an SSE stream, falls back to polling when
 * the stream drops, and re-infers each split client-side so threshold edits
 * recolor instantly without a server round-trip.
 */
export function useFeed({
  file,
  thresholds,
  pollingMs,
  useFallbackAlways,
  online,
}: UseFeedParams) {
  const [raw, setRaw] = useState<FeedEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const haveData = useRef(false);

  useEffect(() => {
    // Reset feed state whenever the source/transport changes, then (re)subscribe.
    /* eslint-disable react-hooks/set-state-in-effect -- reset subscription-derived state on dependency change */
    haveData.current = false;
    setRaw([]);

    if (!file) {
      setStatus("error");
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    let cancelled = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const applySnapshot = (snap: FeedSnapshot, polling: boolean) => {
      if (cancelled) return;
      haveData.current = true;
      setRaw(snap.entries);
      setStatus(
        snap.entries.length === 0 ? "empty" : polling ? "polling" : "live",
      );
    };

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/feed/tail?file=${encodeURIComponent(file)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(String(res.status));
        const { snapshot } = (await res.json()) as { snapshot: FeedSnapshot };
        applySnapshot(snapshot, true);
      } catch {
        if (!cancelled && !haveData.current) setStatus("error");
      }
    };

    const startPolling = () => {
      if (pollTimer || cancelled) return;
      if (!haveData.current) setStatus("connecting");
      void poll();
      pollTimer = setInterval(() => void poll(), Math.max(500, pollingMs));
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startSSE = () => {
      setStatus("connecting");
      es = new EventSource(`/api/feed/stream?file=${encodeURIComponent(file)}`);

      es.addEventListener("snapshot", (ev) => {
        stopPolling();
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        try {
          applySnapshot(JSON.parse((ev as MessageEvent).data) as FeedSnapshot, false);
        } catch {
          // ignore malformed frame
        }
      });

      es.addEventListener("feederror", () => {
        if (!haveData.current) setStatus("error");
      });

      es.onerror = () => {
        // Connection dropped; EventSource auto-retries. Arrange polling fallback.
        setStatus(haveData.current ? "reconnecting" : "connecting");
        if (!fallbackTimer) {
          fallbackTimer = setTimeout(startPolling, FALLBACK_DELAY_MS);
        }
      };
    };

    if (useFallbackAlways) startPolling();
    else startSSE();

    return () => {
      cancelled = true;
      es?.close();
      stopPolling();
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [file, pollingMs, useFallbackAlways]);

  const entries = useMemo<FeedEntry[]>(
    () => raw.map((e) => ({ ...e, split: inferSplit(e.seconds, thresholds) })),
    [raw, thresholds],
  );

  // Offline is informational: only surface it when the connection is actually struggling.
  const effectiveStatus: ConnectionStatus =
    !online && (status === "reconnecting" || status === "connecting")
      ? "offline"
      : status;

  return { entries, status: effectiveStatus };
}
