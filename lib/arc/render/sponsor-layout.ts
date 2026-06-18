// lib/arc/render/sponsor-layout.ts
/** A cell rectangle within a sponsor component, in local px. */
export interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Resolve the column count for a grid: explicit (clamped to count) or near-square. */
export function sponsorColumns(
  columns: number | "auto",
  count: number,
  w: number,
  h: number,
): number {
  const n = Math.max(1, count);
  if (columns === "auto") {
    return Math.max(1, Math.min(n, Math.round(Math.sqrt((n * w) / h))));
  }
  return Math.max(1, Math.min(n, Math.round(columns)));
}

/**
 * Lay out `count` logos as an even grid in a `w × h` box. `gap` is a fraction of the
 * box's short edge, applied uniformly between and around cells, so a tall leg reads
 * as an evenly-spaced vertical stack (the designer reference look).
 */
export function sponsorGrid(
  count: number,
  w: number,
  h: number,
  cols: number,
  gap: number,
): Cell[] {
  const n = Math.max(0, count);
  if (n === 0) return [];
  const c = Math.max(1, cols);
  const rows = Math.ceil(n / c);
  const g = Math.max(0, gap) * Math.min(w, h);
  const cellW = (w - g * (c + 1)) / c;
  const cellH = (h - g * (rows + 1)) / rows;
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % c;
    const row = Math.floor(i / c);
    cells.push({
      x: g + col * (cellW + g),
      y: g + row * (cellH + g),
      w: Math.max(1, cellW),
      h: Math.max(1, cellH),
    });
  }
  return cells;
}
