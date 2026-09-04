"use client";

import { useRef } from "react";

import type { FeedEntry, RaceCategory } from "@/lib/feed/types";

/**
 * Tracks the performance.now() timestamp and category of the most recent new entry
 * in the feed. Used to drive the background pulse in the compositor.
 *
 * Updates happen synchronously during render via refs — no state, no re-renders.
 */
export function useLastArrival(entries: FeedEntry[]): {
  lastArrivalMs: number;
  lastArrivalCategory: RaceCategory | null;
} {
  const prevIdRef = useRef<string | null>(null);
  const msRef = useRef<number>(0);
  const categoryRef = useRef<RaceCategory | null>(null);

  const newest = entries[0] ?? null;
  if (newest && newest.id !== prevIdRef.current) {
    prevIdRef.current = newest.id;
    msRef.current = typeof performance !== "undefined" ? performance.now() : 0;
    categoryRef.current = newest.category;
  }

  return { lastArrivalMs: msRef.current, lastArrivalCategory: categoryRef.current };
}
