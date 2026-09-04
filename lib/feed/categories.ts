import type { RaceCategory } from "./types";

/**
 * Bib ranges per race category. The feed file is a raw netcat stream we only
 * prettify — it carries no category field — so the category is derived from the
 * bib number, which is how the event actually allocates them:
 *
 *   ultra  0–264
 *   half   400–700
 *   relay  800 and up
 *
 * Anything outside those windows falls back to "other": still shown, just
 * without a category accent, so an unexpected bib is never dropped.
 */
export const CATEGORY_RANGES: { category: Exclude<RaceCategory, "other">; min: number; max: number }[] = [
  { category: "ultra", min: 0, max: 264 },
  { category: "half", min: 400, max: 700 },
  { category: "relay", min: 800, max: Number.POSITIVE_INFINITY },
];

/**
 * Infer the race category from a bib token. Non-numeric bibs (or ones in a gap
 * between ranges) return "other".
 */
export function inferCategory(bib: string): RaceCategory {
  // Digits only — `Number("")` is 0, which would silently read as an ultra bib.
  if (!/^\d+$/.test(bib.trim())) return "other";
  const n = Number(bib.trim());
  const hit = CATEGORY_RANGES.find((r) => n >= r.min && n <= r.max);
  return hit ? hit.category : "other";
}
