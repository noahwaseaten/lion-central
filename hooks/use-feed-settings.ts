"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { NO_OFFSETS } from "@/lib/feed/offsets";
import type { FeedOffsets } from "@/lib/feed/types";
import { pushLive, subscribeLive } from "@/lib/live/client";

export interface FeedSettings {
  /** Selected feed filename (within FEED_DIR), or null if none chosen. */
  file: string | null;
  /** Display-time corrections applied on top of the raw feed. */
  offsets: FeedOffsets;
  /** Polling fallback interval in ms. */
  pollingMs: number;
  /** Force polling even when SSE is available (for known-flaky setups). */
  useFallbackAlways: boolean;
}

const KEY = "lion-central.live";

const DEFAULTS: FeedSettings = {
  file: null,
  offsets: NO_OFFSETS,
  pollingMs: 1500,
  useFallbackAlways: false,
};

/**
 * Coerce persisted/pushed settings into a complete `FeedSettings`. Nested
 * `offsets` is merged rather than replaced, so a payload written before a field
 * existed (or by an older client) still yields a usable object.
 */
function normalize(raw: unknown): FeedSettings {
  if (!raw || typeof raw !== "object") return DEFAULTS;
  const parsed = raw as Partial<FeedSettings>;
  return {
    ...DEFAULTS,
    ...parsed,
    offsets: { ...DEFAULTS.offsets, ...parsed.offsets },
  };
}

/**
 * Feed settings — cached in localStorage, pushed to the server so every
 * connected machine shares them. The push happens only from `update()` (a
 * deliberate operator action), never from a generic "settings changed"
 * effect — that would also fire right after mount hydration, when `settings`
 * is still `DEFAULTS` on a machine with no local cache, and reset everyone's
 * chosen feed file/offsets.
 */
export function useFeedSettings() {
  const [settings, setSettings] = useState<FeedSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });

  // One-time hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate persisted settings once on mount */
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings(normalize(JSON.parse(raw)));
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Cache locally whenever settings change (including server-pushed updates),
  // for fast same-tab reloads and as an offline fallback. Never pushes.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / privacy mode
    }
  }, [settings, loaded]);

  // Keep every other client — other tabs, and (via the server) other machines
  // like a tunneled control page or `/output/*` — in sync when the operator
  // changes settings.
  useEffect(() => {
    return subscribeLive((live) => {
      if (!live.feedSettings) return;
      setSettings(normalize(live.feedSettings));
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

  const update = useCallback((patch: Partial<FeedSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    void pushLive("feedSettings", next);
  }, []);

  return { settings, update, loaded };
}
