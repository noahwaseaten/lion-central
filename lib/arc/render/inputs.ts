import type { ConnectionStatus, FeedEntry } from "@/lib/feed/types";

import type { ArcConfig } from "../content";

/** Everything the compositor needs to draw any surface at a given frame. */
export interface SurfaceInputs {
  config: ArcConfig;
  feed: { entries: FeedEntry[]; status: ConnectionStatus };
  clock: { ms: number; running: boolean };
}
