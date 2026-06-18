/**
 * Arc display layout constants — the single source of truth for the physical
 * surface dimensions that make up the arc.
 *
 * The arc is an inverted-U archway: a horizontal TOP BAR with a CLOCK panel
 * mounted on top-center, and two vertical LEGS hanging from the sides. Front and
 * back faces carry LED content; the inner/top/bottom edges are bare frame.
 *
 * All values are native CSS pixels at unscaled size; `ScaleToFit` uniformly
 * scales a surface to whatever screen/projector it runs on, and the 3D preview
 * maps each surface onto the arc geometry at these proportions.
 */

/** Horizontal top bar. */
export const TOP_BAR = { w: 1280, h: 256 } as const;

/** Clock panel mounted on top of the bar, centered. */
export const CLOCK = { w: 384, h: 96 } as const;

/** Each vertical leg. */
export const LEG = { w: 128, h: 640 } as const;

/** Width of each sponsor shoulder flanking the center column. */
export const SHOULDER_W = 315;

/** Height of the brand strip above the feed (within the center column). */
export const BRAND_H = 100;

/** Center live-feed region. */
export const FEED = {
  w: TOP_BAR.w - SHOULDER_W * 2, // 650
  h: TOP_BAR.h - BRAND_H, // 156
} as const;

/**
 * How many recent athlete lines the feed routes tail from the file. The feed
 * component derives its visible row count from its own height (up to 6), and the
 * client accumulates history across snapshots, so a small buffer here keeps a
 * tall feed filled on first load.
 */
export const FEED_ROWS = 6;

/** Depth of the arc structure in the 3D preview (native px units). */
export const ARC_DEPTH = 120;
