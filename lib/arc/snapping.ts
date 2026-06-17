import type { NormRect } from "./layout-model";

/**
 * Alignment snapping for the stage editor, in a surface's normalized coordinates.
 * A moved or resized component snaps its edges and centers to the surface's
 * 0 / 0.5 / 1 lines and to sibling components' edges and centers, within a
 * threshold. Pure so it can be unit-tested without the DOM.
 */

/** A guide line to draw while snapping, in normalized surface coords. */
export interface Guide {
  axis: "x" | "y";
  pos: number;
}

export interface SnapResult {
  rect: NormRect;
  guides: Guide[];
}

/** Which edges a resize handle moves. */
export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const SURFACE_LINES = [0, 0.5, 1];

function xCandidates(siblings: NormRect[]): number[] {
  return [...SURFACE_LINES, ...siblings.flatMap((s) => [s.x, s.x + s.w / 2, s.x + s.w])];
}
function yCandidates(siblings: NormRect[]): number[] {
  return [...SURFACE_LINES, ...siblings.flatMap((s) => [s.y, s.y + s.h / 2, s.y + s.h])];
}

/** Best snap across several points → the candidate line and the delta to reach it. */
function bestSnap(
  points: number[],
  candidates: number[],
  threshold: number,
): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const pt of points) {
    for (const c of candidates) {
      const d = c - pt;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) {
        best = { delta: d, line: c };
      }
    }
  }
  return best;
}

/** Snap a moved rect (position only) to surface lines and siblings. */
export function snapMove(rect: NormRect, siblings: NormRect[], tx: number, ty = tx): SnapResult {
  const sx = bestSnap([rect.x, rect.x + rect.w / 2, rect.x + rect.w], xCandidates(siblings), tx);
  const sy = bestSnap([rect.y, rect.y + rect.h / 2, rect.y + rect.h], yCandidates(siblings), ty);
  const guides: Guide[] = [];
  let { x, y } = rect;
  if (sx) {
    x += sx.delta;
    guides.push({ axis: "x", pos: sx.line });
  }
  if (sy) {
    y += sy.delta;
    guides.push({ axis: "y", pos: sy.line });
  }
  return { rect: { ...rect, x, y }, guides };
}

const MIN = 0.04;

/** Snap a resized rect: only the edges the handle moves are snapped. */
export function snapResize(
  rect: NormRect,
  handle: Handle,
  siblings: NormRect[],
  tx: number,
  ty = tx,
): SnapResult {
  const guides: Guide[] = [];
  let { x, y, w, h } = rect;
  const right = x + w;
  const bottom = y + h;

  if (handle.includes("w")) {
    const s = bestSnap([x], xCandidates(siblings), tx);
    if (s) {
      const nx = Math.min(x + s.delta, right - MIN);
      w = right - nx;
      x = nx;
      guides.push({ axis: "x", pos: s.line });
    }
  }
  if (handle.includes("e")) {
    const s = bestSnap([right], xCandidates(siblings), tx);
    if (s) {
      w = Math.max(MIN, right + s.delta - x);
      guides.push({ axis: "x", pos: s.line });
    }
  }
  if (handle.includes("n")) {
    const s = bestSnap([y], yCandidates(siblings), ty);
    if (s) {
      const ny = Math.min(y + s.delta, bottom - MIN);
      h = bottom - ny;
      y = ny;
      guides.push({ axis: "y", pos: s.line });
    }
  }
  if (handle.includes("s")) {
    const s = bestSnap([bottom], yCandidates(siblings), ty);
    if (s) {
      h = Math.max(MIN, bottom + s.delta - y);
      guides.push({ axis: "y", pos: s.line });
    }
  }

  return { rect: { x, y, w, h }, guides };
}
