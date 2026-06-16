import { FEED, SHOULDER_W, TOP_BAR, TOP_STRIP_H } from "@/lib/arc/layout";
import { LiveFeedBar } from "@/components/live/live-feed-bar";
import type { ConnectionStatus, FeedEntry } from "@/lib/feed/types";

import { SponsorSlot } from "./sponsor-slot";

/**
 * The full 1280×256 top bar: a sponsor strip across the top, sponsor shoulders
 * left/right, and the live feed in the bottom-center region.
 */
export function TopBarStage({
  entries,
  status,
}: {
  entries: FeedEntry[];
  status: ConnectionStatus;
}) {
  return (
    <div
      className="flex flex-col bg-white"
      style={{ width: TOP_BAR.w, height: TOP_BAR.h }}
    >
      <SponsorSlot name="Sponsor" className="w-full" style={{ height: TOP_STRIP_H }} />
      <div className="flex flex-1 min-h-0">
        <SponsorSlot name="Sponsor" style={{ width: SHOULDER_W }} className="h-full" />
        <div style={{ width: FEED.w }} className="h-full">
          <LiveFeedBar entries={entries} status={status} />
        </div>
        <SponsorSlot name="Sponsor" style={{ width: SHOULDER_W }} className="h-full" />
      </div>
    </div>
  );
}
