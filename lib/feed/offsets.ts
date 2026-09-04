import { inferCategory } from "./categories";
import { formatLikeToken } from "./format";
import type { FeedEntry, FeedOffsets } from "./types";

/** No corrections — every time shown exactly as the feed reports it. */
export const NO_OFFSETS: FeedOffsets = { halfOffsetSec: 0 };

/** Seconds to subtract from an entry, given its category. */
function offsetFor(entry: Pick<FeedEntry, "category">, offsets: FeedOffsets): number {
  return entry.category === "half" ? Math.max(0, offsets.halfOffsetSec) : 0;
}

/**
 * Re-derive the category and display time for an entry. Both are computed from
 * the bib and the raw seconds, never stored in the feed file, so this can run
 * again on the client the moment the operator changes the offset — no server
 * round-trip, no rewriting of the source data.
 */
export function applyOffsets(
  entry: Omit<FeedEntry, "category" | "displaySeconds" | "displayTime">,
  offsets: FeedOffsets = NO_OFFSETS,
): FeedEntry {
  const category = inferCategory(entry.bib);
  const displaySeconds = Math.max(0, entry.seconds - offsetFor({ category }, offsets));
  return {
    ...entry,
    category,
    displaySeconds,
    displayTime:
      displaySeconds === entry.seconds ? entry.timeRaw : formatLikeToken(displaySeconds, entry.timeRaw),
  };
}
