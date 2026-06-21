"use client";

import { useRef } from "react";

import type { FeedEntry } from "@/lib/feed/types";
import type { Split } from "@/lib/feed/types";

/**
 * Tracks the performance.now() timestamp and split of the most recent new entry
 * in the feed. Used to drive the background pulse in the compositor.
 *
 * Updates happen synchronously during render via refs — no state, no re-renders.
 */
export function useLastArrival(entries: FeedEntry[]): {
  lastArrivalMs: number;
  lastArrivalSplit: Split | null;
} {
  const prevIdRef = useRef<string | null>(null);
  const msRef = useRef<number>(0);
  const splitRef = useRef<Split | null>(null);

  const newest = entries[0] ?? null;
  if (newest && newest.id !== prevIdRef.current) {
    prevIdRef.current = newest.id;
    msRef.current = typeof performance !== "undefined" ? performance.now() : 0;
    splitRef.current = newest.split;
  }

  return { lastArrivalMs: msRef.current, lastArrivalSplit: splitRef.current };
}
