import type { Split, SplitThresholds } from "./types";

/**
 * Default split windows. These are PLACEHOLDERS — the operator must tune them
 * per event in the setup drawer. Values are cumulative seconds since gun start.
 */
export const DEFAULT_THRESHOLDS: SplitThresholds = {
  swimEndSec: 45 * 60, // 45:00
  bikeEndSec: 3 * 60 * 60 + 30 * 60, // 3:30:00
  graceSec: 2 * 60, // 2:00
};

/**
 * Infer the active split from cumulative race time.
 *
 * Stateless: derived purely from `seconds` against the thresholds. The grace
 * buffer keeps an athlete in the prior split briefly past a boundary so a
 * crossing right at the line isn't misclassified.
 */
export function inferSplit(
  seconds: number,
  thresholds: SplitThresholds = DEFAULT_THRESHOLDS,
): Split {
  const { swimEndSec, bikeEndSec, graceSec } = thresholds;
  if (seconds < swimEndSec + graceSec) return "swim";
  if (seconds < bikeEndSec + graceSec) return "bike";
  return "run";
}
