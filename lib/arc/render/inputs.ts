import type { ConnectionStatus, FeedEntry } from "@/lib/feed/types";
import type { Split } from "@/lib/feed/types";

import type { ArcConfig } from "../content";

export interface AnnouncementRecord {
  text: string;
  subtitle?: string;
  startedAt: number; // Date.now() ms
  endsAt: number;    // Date.now() ms
}

/** Everything the compositor needs to draw any surface at a given frame. */
export interface SurfaceInputs {
  config: ArcConfig;
  feed: {
    entries: FeedEntry[];
    status: ConnectionStatus;
    /** performance.now() timestamp when the newest unique entry first appeared; 0 if none yet. */
    lastArrivalMs: number;
    /** Split of the athlete whose arrival set lastArrivalMs; null if none yet. */
    lastArrivalSplit: Split | null;
  };
  clock: { ms: number; running: boolean };
  /** Active announcement to overlay on all surfaces; null when none. */
  announcement: AnnouncementRecord | null;
}
