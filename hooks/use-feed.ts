"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { applyOffsets } from "@/lib/feed/offsets";
import type {
  ConnectionStatus,
  FeedEntry,
  FeedOffsets,
  FeedSnapshot,
} from "@/lib/feed/types";

interface UseFeedParams {
  file: string | null;
  offsets: FeedOffsets;
  pollingMs: number;
  useFallbackAlways: boolean;
  online: boolean;
}

/** Delay before SSE connection trouble escalates to polling. */
const FALLBACK_DELAY_MS = 4000;

/**
 * Orchestrates the live feed: opens an SSE stream, falls back to polling when
 * the stream drops, and re-derives each entry's category and display time
 * client-side so an offset edit applies instantly without a server round-trip.
 */
export function useFeed({
  file,
  offsets,
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

    let pending: { snap: FeedSnapshot; polling: boolean } | null = null;
    let flushRaf = 0;

    const flush = () => {
      flushRaf = 0;
      if (cancelled || !pending) return;
      const { snap, polling } = pending;
      pending = null;
      haveData.current = true;
      setRaw(snap.entries);
      setStatus(snap.entries.length === 0 ? "empty" : polling ? "polling" : "live");
    };

    const applySnapshot = (snap: FeedSnapshot, polling: boolean) => {
      if (cancelled) return;
      // Keep only the latest snapshot and apply once per frame, so a burst of SSE
      // frames can't trigger a React render storm.
      pending = { snap, polling };
      if (!flushRaf) flushRaf = requestAnimationFrame(flush);
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
      if (flushRaf) cancelAnimationFrame(flushRaf);
    };
  }, [file, pollingMs, useFallbackAlways]);

  const entries = useMemo<FeedEntry[]>(
    () => raw.map((e) => applyOffsets(e, offsets)),
    [raw, offsets],
  );

  // Offline is informational: only surface it when the connection is actually struggling.
  const effectiveStatus: ConnectionStatus =
    !online && (status === "reconnecting" || status === "connecting")
      ? "offline"
      : status;

  return { entries, status: effectiveStatus };
}
