import { applyOffsets, NO_OFFSETS } from "./offsets";
import type { FeedEntry, FeedOffsets } from "./types";

/**
 * Parse a TIME token (`HH:MM:SS`, `H:MM:SS`, or `MM:SS`) into seconds.
 * Returns `null` for anything unparseable.
 */
export function parseTime(raw: string): number | null {
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const nums = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n))) return null;

  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/** Title-case a single uppercase/lowercase name token for display. */
function titleCase(token: string): string {
  if (!token) return token;
  return token[0].toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Parse one feed line: `BIB FIRSTNAME LASTNAME TIME` (whitespace-delimited,
 * tolerant of repeated spaces and multi-word names).
 *
 * - first token  = BIB
 * - last token   = TIME
 * - middle token(s) = name
 *
 * Returns `null` for malformed lines (skipped, never fatal).
 */
export function parseLine(
  raw: string,
  offsets: FeedOffsets = NO_OFFSETS,
): FeedEntry | null {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  const bib = tokens[0];
  const timeRaw = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1);

  const seconds = parseTime(timeRaw);
  if (seconds === null) return null;

  const first = middle[0] ?? "";
  const last = middle.slice(1).join(" ");
  const name = middle.map(titleCase).join(" ");

  return applyOffsets({ id: `${bib}-${timeRaw}`, bib, first, last, name, timeRaw, seconds }, offsets);
}

/**
 * Parse a batch of raw lines (file order: oldest → newest), keep the last
 * `count` valid entries, and return them newest-first for display.
 */
export function parseLines(
  lines: string[],
  count: number,
  offsets: FeedOffsets = NO_OFFSETS,
): FeedEntry[] {
  const valid: FeedEntry[] = [];
  for (const line of lines) {
    const entry = parseLine(line, offsets);
    if (entry) valid.push(entry);
  }
  return valid.slice(-count).reverse();
}
