"use client";

import { useCallback, useEffect, useState } from "react";

import type { AnnouncementRecord } from "@/lib/arc/render/inputs";
import { pushLive, subscribeLive } from "@/lib/live/client";

const STORAGE_KEY = "lion-central.arc.announcement";

function readRecord(): AnnouncementRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as AnnouncementRecord;
    if (!rec.permanent && Date.now() > rec.endsAt) return null;
    return rec;
  } catch {
    return null;
  }
}

export function useAnnouncement(): {
  announcement: AnnouncementRecord | null;
  /** `durationMs: null` sends a permanent announcement (stays until cancelled). */
  send: (text: string, subtitle: string | undefined, durationMs: number | null, urgent: boolean) => void;
  /** Adds `durationMs` on top of the current remaining time; `null` makes it permanent. */
  extend: (durationMs: number | null) => void;
  cancel: () => void;
} {
  const [announcement, setAnnouncement] = useState<AnnouncementRecord | null>(null);

  // Load from localStorage on mount, then keep every other client — other
  // tabs, and (via the server) other machines like a tunneled `/output/*` or
  // an OBS browser source — in sync with send/extend/cancel.
  useEffect(() => {
    setAnnouncement(readRecord());
    return subscribeLive((live) => {
      if (!("announcement" in live)) return;
      const rec = live.announcement as AnnouncementRecord | null;
      setAnnouncement(rec && (rec.permanent || Date.now() <= rec.endsAt) ? rec : null);
    });
  }, []);

  // Auto-expire: clear local state when endsAt passes (permanent ones never do).
  useEffect(() => {
    if (!announcement || announcement.permanent) return;
    const remaining = announcement.endsAt - Date.now();
    if (remaining <= 0) { setAnnouncement(null); return; }
    const id = setTimeout(() => setAnnouncement(null), remaining);
    return () => clearTimeout(id);
  }, [announcement]);

  const send = useCallback(
    (text: string, subtitle: string | undefined, durationMs: number | null, urgent: boolean) => {
      const now = Date.now();
      const rec: AnnouncementRecord = {
        text,
        subtitle: subtitle?.trim() || undefined,
        startedAt: now,
        endsAt: durationMs === null ? now : now + durationMs,
        permanent: durationMs === null,
        urgent,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
      setAnnouncement(rec);
      void pushLive("announcement", rec);
    },
    [],
  );

  const extend = useCallback(
    (durationMs: number | null) => {
      if (!announcement) return;
      const next: AnnouncementRecord =
        durationMs === null
          ? { ...announcement, permanent: true }
          : { ...announcement, permanent: false, endsAt: Math.max(announcement.endsAt, Date.now()) + durationMs };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / privacy mode
      }
      setAnnouncement(next);
      void pushLive("announcement", next);
    },
    [announcement],
  );

  const cancel = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAnnouncement(null);
    void pushLive("announcement", null);
  }, []);

  return { announcement, send, extend, cancel };
}
