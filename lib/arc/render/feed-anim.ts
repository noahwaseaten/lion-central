/**
 * Per-component live-feed ticker state. Each feed component on a canvas keeps the
 * athletes it has seen (newest appended) and shows the latest few, newest at the
 * bottom — static. When a new athlete line is appended to the source file a new id
 * appears, and the column glides up exactly one row to reveal it, then rests.
 *
 * Motion is therefore a pure function of the file's data: nothing animates until
 * the next append. (Reduced motion swaps instantly with no glide.)
 */

import type { FeedEntry } from "@/lib/feed/types";

/** How long the eased one-row glide takes when a new athlete arrives. */
const TRANSITION_MS = 760;
/** Window during which a freshly-seen athlete is highlighted. */
const FRESH_MS = 2800;
/** Cap on retained history so memory stays bounded. */
const MAX_HISTORY = 60;

interface TickerState {
  /** Athlete ids in chronological order (oldest first). */
  order: string[];
  /** Latest entry object per id (split can recolor as thresholds change). */
  byId: Map<string, FeedEntry>;
  /** When each id was first seen on this canvas. */
  firstSeen: Map<string, number>;
  /** The newest id currently settled — a change means a new append to animate. */
  newestId: string | null;
  /** When the current one-row glide began (0 = settled, nothing animating). */
  glideStart: number;
  /** How many rows the current glide moves (1 normally; a batch on simultaneous arrivals). */
  shiftRows: number;
}

const states = new WeakMap<HTMLCanvasElement, Map<string, TickerState>>();

function stateFor(canvas: HTMLCanvasElement, key: string): TickerState {
  let perCanvas = states.get(canvas);
  if (!perCanvas) {
    perCanvas = new Map();
    states.set(canvas, perCanvas);
  }
  let st = perCanvas.get(key);
  if (!st) {
    st = { order: [], byId: new Map(), firstSeen: new Map(), newestId: null, glideStart: 0, shiftRows: 0 };
    perCanvas.set(key, st);
  }
  return st;
}

/** One positioned row ready to paint. */
export interface TickerRow {
  entry: FeedEntry;
  /** Top edge of the row within the feed area, in px. */
  y: number;
  /** 0–1 opacity (rows fade as they cross the top/bottom edge during a glide). */
  alpha: number;
  /** 0–1 freshness, 1 right after arrival, decaying to 0 — drives the highlight. */
  fresh: number;
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

let reducedMotion: boolean | null = null;
function prefersReducedMotion(): boolean {
  if (reducedMotion === null) {
    reducedMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
  }
  return reducedMotion;
}

/**
 * Ingest the current feed snapshot (newest-first) for the `key`-identified feed
 * component on `canvas` and return the rows to draw at time `now`, laid out across
 * `rows` slots of total height `h`. Returns an empty array when nothing's been
 * seen yet.
 */
export function tickerRows(
  canvas: HTMLCanvasElement,
  key: string,
  entries: FeedEntry[],
  rows: number,
  h: number,
  now: number,
): TickerRow[] {
  const st = stateFor(canvas, key);

  // Snapshot arrives newest-first; ingest oldest-first so history reads forward.
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    st.byId.set(e.id, e); // refresh data (e.g. recolored split)
    if (!st.firstSeen.has(e.id)) {
      st.firstSeen.set(e.id, now);
      st.order.push(e.id);
    }
  }
  while (st.order.length > MAX_HISTORY) {
    const id = st.order.shift()!;
    st.byId.delete(id);
    st.firstSeen.delete(id);
  }

  const n = st.order.length;
  if (n === 0) return [];

  // A change in the newest id means the file gained one or more lines.
  const newest = st.order[n - 1];
  if (newest !== st.newestId) {
    const prevIdx = st.newestId ? st.order.indexOf(st.newestId) : -1;
    // How many genuinely-new ids arrived since the last settled newest. On first
    // sight (or if the previous newest scrolled out of history), treat all as new.
    const newCount = prevIdx >= 0 ? n - 1 - prevIdx : n;
    st.newestId = newest;
    st.glideStart = now;
    st.shiftRows = Math.max(1, newCount);
  }

  // A burst bigger than the window snaps instantly (no glide); otherwise ease.
  const snap = st.shiftRows > rows;
  const p =
    prefersReducedMotion() || st.glideStart === 0 || snap
      ? 1
      : easeInOut(clamp01((now - st.glideStart) / TRANSITION_MS));

  const rowH = h / rows;
  const shift = (1 - p) * st.shiftRows * rowH; // column starts shiftRows lower, rises to rest
  const count = Math.min(n, rows);
  const extra = p < 1 ? Math.min(st.shiftRows, n - count) : 0; // rows leaving off the top
  const firstNewIdx = n - st.shiftRows; // ids at/after this index are the new arrivals
  const freshOf = (id: string) => clamp01(1 - (now - (st.firstSeen.get(id) ?? now)) / FRESH_MS);

  const out: TickerRow[] = [];
  const rendered = count + extra;
  for (let r = 0; r < rendered; r++) {
    const idx = n - rendered + r;
    if (idx < 0) continue;
    const id = st.order[idx];
    const entry = st.byId.get(id);
    if (!entry) continue;
    const slot = rows - count + (r - extra); // negative slots are leaving rows above the top
    const incoming = idx >= firstNewIdx; // a just-arrived row fades in
    const alpha = slot < 0 ? clamp01(1 - p) : incoming ? clamp01(p) : 1;
    out.push({ entry, y: slot * rowH + shift, alpha, fresh: freshOf(id) });
  }

  return out;
}
