/**
 * Compute a canvas backing-store size from its displayed CSS size and the device
 * pixel ratio, so the canvas paints at true device resolution (no blur / "half
 * quality"). The longest edge is capped so extreme zoom can't allocate a huge
 * buffer; aspect ratio is preserved when capping.
 */
export function backingSize(
  cssW: number,
  cssH: number,
  dpr: number,
  maxEdge = 4096,
): { w: number; h: number } {
  let w = Math.max(1, Math.round(cssW * dpr));
  let h = Math.max(1, Math.round(cssH * dpr));
  const longest = Math.max(w, h);
  if (longest > maxEdge) {
    const k = maxEdge / longest;
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
  }
  return { w, h };
}
