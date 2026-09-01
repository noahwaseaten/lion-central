"use client";

import { useCallback, useEffect, useState } from "react";

import type { AnnouncementRecord } from "@/lib/arc/render/inputs";

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

  // Load from localStorage on mount + listen for cross-tab changes.
  useEffect(() => {
    setAnnouncement(readRecord());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setAnnouncement(readRecord());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
    },
    [announcement],
  );

  const cancel = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAnnouncement(null);
  }, []);

  return { announcement, send, extend, cancel };
}
