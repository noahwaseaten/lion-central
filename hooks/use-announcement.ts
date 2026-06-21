"use client";

import { useCallback, useEffect, useState } from "react";

import type { AnnouncementRecord } from "@/lib/arc/render/inputs";

const STORAGE_KEY = "lion-central.arc.announcement";

function readRecord(): AnnouncementRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as AnnouncementRecord;
    if (Date.now() > rec.endsAt) return null;
    return rec;
  } catch {
    return null;
  }
}

export function useAnnouncement(): {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number) => void;
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

  // Auto-expire: clear local state when endsAt passes.
  useEffect(() => {
    if (!announcement) return;
    const remaining = announcement.endsAt - Date.now();
    if (remaining <= 0) { setAnnouncement(null); return; }
    const id = setTimeout(() => setAnnouncement(null), remaining);
    return () => clearTimeout(id);
  }, [announcement]);

  const send = useCallback((text: string, subtitle: string | undefined, durationMs: number) => {
    const rec: AnnouncementRecord = {
      text,
      subtitle: subtitle?.trim() || undefined,
      startedAt: Date.now(),
      endsAt: Date.now() + durationMs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    setAnnouncement(rec);
  }, []);

  const cancel = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAnnouncement(null);
  }, []);

  return { announcement, send, cancel };
}
