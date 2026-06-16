/**
 * Arc display layout constants.
 *
 * Single source of truth for the physical surface dimensions and the
 * composition of the top bar (sponsor strip + shoulders + live-feed region).
 * All values are in CSS pixels at native (unscaled) size; `ScaleToFit`
 * uniformly scales the whole surface to whatever screen it runs on.
 */

export const TOP_BAR = { w: 1280, h: 256 } as const;

/** Full-width sponsor / brand strip across the top of the bar. */
export const TOP_STRIP_H = 44;

/** Width of each sponsor "shoulder" flanking the live feed. */
export const SHOULDER_W = 260;

/** Bottom-center live-feed region (holds the 3 stacked rows). */
export const FEED = {
  w: TOP_BAR.w - SHOULDER_W * 2, // 760
  h: TOP_BAR.h - TOP_STRIP_H, // 212
  x: SHOULDER_W, // 260
  y: TOP_STRIP_H, // 44
} as const;

/** Race-clock surface — a quarter of the top bar on each axis. */
export const CLOCK = { w: 320, h: 64 } as const;

/** Number of athlete rows shown in the feed. */
export const FEED_ROWS = 3;
