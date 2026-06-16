import type { Split } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Human label for a split. */
export function splitLabel(split: Split): string {
  return split === "swim" ? "Swim" : split === "bike" ? "Bike" : "Run";
}

/** The split's time-label shown next to the athlete (changes per leg). */
export function splitTimeLabel(split: Split): string {
  return splitLabel(split);
}

/** Format cumulative seconds as `H:MM:SS`, or `MM:SS` when under an hour. */
export function formatSeconds(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Format a race-clock duration in milliseconds for the counter display. */
export function formatClock(ms: number): string {
  return formatSeconds(ms / 1000);
}
