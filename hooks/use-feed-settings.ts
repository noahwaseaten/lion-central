"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_THRESHOLDS } from "@/lib/feed/splits";
import type { SplitThresholds } from "@/lib/feed/types";

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

/** localStorage-backed feed settings. */
export function useFeedSettings() {
  const [settings, setSettings] = useState<FeedSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

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
  }, [settings, loaded]);

  const update = useCallback(
    (patch: Partial<FeedSettings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );

  return { settings, update, loaded };
}
