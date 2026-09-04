/** A race category, derived from the athlete's bib number. */
export type RaceCategory = "ultra" | "half" | "relay" | "other";

/** One parsed athlete line from the feed file. */
export interface FeedEntry {
  /** Stable key for animation: `${bib}-${timeRaw}`. */
  id: string;
  bib: string;
  first: string;
  last: string;
  /** Display name, e.g. "Marcus Bennett". */
  name: string;
  /** Original TIME token as written in the feed, e.g. "04:18:50". */
  timeRaw: string;
  /** Cumulative race time in seconds, exactly as the feed reports it. */
  seconds: number;
  /** Category inferred from the bib (recomputed client-side, never from the file). */
  category: RaceCategory;
  /** `seconds` after the category offset is applied — what the arc actually shows. */
  displaySeconds: number;
  /** `displaySeconds` formatted in the same shape as `timeRaw`. */
  displayTime: string;
}

/** The current view of the feed: the last N athletes, newest first. */
export interface FeedSnapshot {
  entries: FeedEntry[];
  fileMtimeMs: number;
}

/** Connection / data status surfaced to the display. */
export type ConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "polling"
  | "empty"
  | "error"
  | "offline";

/**
 * Operator-tunable corrections applied on top of the raw feed. The feed file
 * itself is never rewritten — these only change what the arc displays.
 */
export interface FeedOffsets {
  /**
   * Seconds subtracted from every half-marathon time. Half marathons start
   * hours after the other categories but the feed reports one shared gun time,
   * so a 4:30:00 half with a 3h offset displays as 1:30:00.
   */
  halfOffsetSec: number;
}
