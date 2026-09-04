"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_THRESHOLDS } from "@/lib/feed/splits";
import type { SplitThresholds } from "@/lib/feed/types";
import { pushLive, subscribeLive } from "@/lib/live/client";

export interface FeedSettings {
  /** Selected feed filename (within FEED_DIR), or null if none chosen. */
  file: string | null;
  thresholds: SplitThresholds;
  /** Polling fallback interval in ms. */
  pollingMs: number;
  /** Force polling even when SSE is available (for known-flaky setups). */
  useFallbackAlways: boolean;
}

const KEY = "lion-central.live";

const DEFAULTS: FeedSettings = {
  file: null,
  thresholds: DEFAULT_THRESHOLDS,
  pollingMs: 1500,
  useFallbackAlways: false,
};

/** Feed settings — cached in localStorage, synced across machines via the server. */
export function useFeedSettings() {
  const [settings, setSettings] = useState<FeedSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  // Set right before applying a server-pushed update, so the write-back effect
  // below can skip re-pushing it and avoid a ping-pong with the server.
  const suppressPushRef = useRef(false);

  // One-time hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate persisted settings once on mount */
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FeedSettings>;
        setSettings({
          ...DEFAULTS,
          ...parsed,
          thresholds: { ...DEFAULTS.thresholds, ...parsed.thresholds },
        });
      }
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / privacy mode
    }
    if (suppressPushRef.current) {
      suppressPushRef.current = false;
      return;
    }
    void pushLive("feedSettings", settings);
  }, [settings, loaded]);

  // Keep every other client — other tabs, and (via the server) other machines
  // like a tunneled control page or `/output/*` — in sync when the operator
  // changes settings.
  useEffect(() => {
    return subscribeLive((live) => {
      if (!live.feedSettings) return;
      const parsed = live.feedSettings as Partial<FeedSettings>;
      suppressPushRef.current = true;
      setSettings({
        ...DEFAULTS,
        ...parsed,
        thresholds: { ...DEFAULTS.thresholds, ...parsed.thresholds },
      });
    });
  }, []);

  // First run with no file chosen: auto-select the most recent feed file so the
  // feed connects out of the box on the control page *and* every output tab,
  // instead of silently showing "Feed unavailable" until someone picks one.
  const autoTried = useRef(false);
  useEffect(() => {
    if (!loaded || autoTried.current) return;
    autoTried.current = true;
    if (settings.file) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/feed/files", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { files?: { name: string }[] };
        const first = data.files?.[0]?.name;
        if (!cancelled && first) setSettings((s) => (s.file ? s : { ...s, file: first }));
      } catch {
        // FEED_DIR unset / offline — feed surfaces handle the empty state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, settings.file]);

  const update = useCallback(
    (patch: Partial<FeedSettings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );

  return { settings, update, loaded };
}
