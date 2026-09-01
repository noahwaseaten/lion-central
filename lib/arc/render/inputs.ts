import type { ConnectionStatus, FeedEntry } from "@/lib/feed/types";
import type { Split } from "@/lib/feed/types";

import type { ArcConfig } from "../content";

export interface AnnouncementRecord {
  text: string;
  subtitle?: string;
  startedAt: number; // Date.now() ms
  /** Date.now() ms this expires at — ignored (and meaningless) while `permanent`. */
  endsAt: number;
  /** Stays up until explicitly cancelled/extended, instead of auto-expiring at `endsAt`. */
  permanent?: boolean;
  /** Draws the moving caution-tape border. Off = a plain panel for non-urgent notices. */
  urgent: boolean;
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
  /** `direction` is the count direction (-1 while a pre-race countdown is running). */
  clock: { ms: number; running: boolean; direction: 1 | -1 };
  /** Active announcement to overlay on all surfaces; null when none. */
  announcement: AnnouncementRecord | null;
}
