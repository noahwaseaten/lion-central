"use client";

import { AnimatePresence } from "motion/react";

import type { ConnectionStatus, FeedEntry } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

import { FeedEmpty, FeedError, FeedSkeleton, StatusPill } from "./feed-state-overlays";
import { FeedRow } from "./feed-row";

/** The bottom-center live-feed region: renders rows + every connection state. */
export function LiveFeedBar({
  entries,
  status,
}: {
  entries: FeedEntry[];
  status: ConnectionStatus;
}) {
  const showRows = entries.length > 0;
  const dim = status === "reconnecting" || status === "offline";

  return (
    <div className="relative flex h-full w-full flex-col bg-white text-neutral-950 [perspective:900px]">
      {!showRows && status === "empty" && <FeedEmpty />}
      {!showRows && status === "error" && <FeedError />}
      {!showRows && (status === "connecting" || status === "polling") && <FeedSkeleton />}

      {showRows && (
        <div className={cn("flex h-full w-full flex-col transition-opacity", dim && "opacity-90")}>
          <AnimatePresence mode="popLayout" initial={false}>
            {entries.map((entry, i) => (
              <FeedRow key={entry.id} entry={entry} newest={i === 0} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <StatusPill status={status} />
    </div>
  );
}
