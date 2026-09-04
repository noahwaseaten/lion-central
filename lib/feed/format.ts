import type { RaceCategory } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Human label for a race category; "other" has none (rendered without a tag). */
export function categoryLabel(category: RaceCategory): string {
  switch (category) {
    case "ultra":
      return "Ultra";
    case "half":
      return "Half";
    case "relay":
      return "Relay";
    case "other":
      return "";
  }
}

/** Format cumulative seconds as `H:MM:SS`, or `MM:SS` when under an hour. */
export function formatSeconds(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Format seconds in the same shape as the feed's own TIME token, so an adjusted
 * half-marathon time still lines up with the unadjusted rows around it — a
 * `04:30:00` source keeps its two-digit hour and reads `01:30:00`, not `1:30:00`.
 */
export function formatLikeToken(total: number, template: string): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const segments = template.split(":");
  if (segments.length < 3 && h === 0) return `${pad(m)}:${pad(s)}`;
  const hourWidth = segments.length === 3 ? Math.max(1, segments[0].length) : 1;
  return `${String(h).padStart(hourWidth, "0")}:${pad(m)}:${pad(s)}`;
}

/** Format a race-clock duration in milliseconds for the counter display. */
export function formatClock(ms: number): string {
  return formatSeconds(ms / 1000);
}
