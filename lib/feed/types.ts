/** A triathlon split. */
export type Split = "swim" | "bike" | "run";

/** One parsed athlete line from the feed file. */
export interface FeedEntry {
  /** Stable key for animation: `${bib}-${timeRaw}`. */
  id: string;
  bib: string;
  first: string;
  last: string;
  /** Display name, e.g. "Marcus Bennett". */
  name: string;
  /** Original TIME token, e.g. "01:18:50". */
  timeRaw: string;
  /** Parsed cumulative race time in seconds. */
  seconds: number;
  /** Inferred split (recomputed client-side when thresholds change). */
  split: Split;
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

/** Operator-tunable boundaries for split inference (cumulative seconds). */
export interface SplitThresholds {
  /** Cumulative time at which swim → bike. */
  swimEndSec: number;
  /** Cumulative time at which bike → run. */
  bikeEndSec: number;
  /** Boundary buffer to avoid premature split bumps. */
  graceSec: number;
}
