import type { NormRect } from "./layout-model";

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const MIN_SIZE = 0.04;

/**
 * Apply one edit to the rect, keeping it inside the surface.
 *
 * The field being edited is the one that gives way: typing a width that would
 * run off the right edge shortens the width rather than silently sliding the
 * component left, which is what the old clamp did and made the numbers feel
 * like they had a mind of their own.
 */
export function applyRectEdit(rect: NormRect, patch: Partial<NormRect>): NormRect {
  const next = { ...rect };
  if (patch.w !== undefined) next.w = clamp(patch.w, MIN_SIZE, 1 - next.x);
  if (patch.h !== undefined) next.h = clamp(patch.h, MIN_SIZE, 1 - next.y);
  if (patch.x !== undefined) next.x = clamp(patch.x, 0, 1 - next.w);
  if (patch.y !== undefined) next.y = clamp(patch.y, 0, 1 - next.h);
  return next;
}
