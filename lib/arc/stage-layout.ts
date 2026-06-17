import { CLOCK, LEG, TOP_BAR } from "./layout";
import type { NormRect } from "./layout-model";
import { getSurface, type SurfaceId } from "./surfaces";

/**
 * Geometry for the 2D arc stage. The arc is laid out as an inverted-U in a single
 * native-px bounding box (origin top-left): the clock sits on top, the top bar
 * below it, and the two legs hang from the bar's ends. Everything here is pure so
 * the stage component and its component overlays derive from one source.
 */

/** Bounding box that contains the whole arc, in native px. */
export const STAGE_BOX = {
  w: TOP_BAR.w,
  h: CLOCK.h + TOP_BAR.h + LEG.h,
} as const;

export interface SurfacePlacement {
  id: SurfaceId;
  /** Native-px position within {@link STAGE_BOX}. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each surface sits inside the bounding box (native px). */
export const SURFACE_PLACEMENTS: SurfacePlacement[] = [
  { id: "clock", x: (TOP_BAR.w - CLOCK.w) / 2, y: 0, w: CLOCK.w, h: CLOCK.h },
  { id: "topbar", x: 0, y: CLOCK.h, w: TOP_BAR.w, h: TOP_BAR.h },
  { id: "leg-left", x: 0, y: CLOCK.h + TOP_BAR.h, w: LEG.w, h: LEG.h },
  { id: "leg-right", x: TOP_BAR.w - LEG.w, y: CLOCK.h + TOP_BAR.h, w: LEG.w, h: LEG.h },
];

const PLACEMENT_BY_ID = new Map(SURFACE_PLACEMENTS.map((p) => [p.id, p]));

export function getPlacement(id: SurfaceId): SurfacePlacement | undefined {
  return PLACEMENT_BY_ID.get(id);
}

export interface NativeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A component's rect in bounding-box native coordinates (surface offset + norm × size). */
export function componentRectNative(surfaceId: SurfaceId, rect: NormRect): NativeRect | undefined {
  const p = PLACEMENT_BY_ID.get(surfaceId);
  if (!p) return undefined;
  return { x: p.x + rect.x * p.w, y: p.y + rect.y * p.h, w: rect.w * p.w, h: rect.h * p.h };
}

/** The pixel size of one component on its native surface (for aspect-ratio previews). */
export function componentPixelSize(surfaceId: SurfaceId, rect: NormRect): { w: number; h: number } {
  const s = getSurface(surfaceId);
  if (!s) return { w: 1, h: 1 };
  return { w: Math.max(1, rect.w * s.w), h: Math.max(1, rect.h * s.h) };
}

/**
 * Uniform scale (native px → CSS px) that fits the bounding box into the given
 * container, leaving `padding` of slack (0–1). Returns 0 for a degenerate box.
 */
export function fitScale(containerW: number, containerH: number, padding = 0.9): number {
  if (containerW <= 0 || containerH <= 0) return 0;
  return Math.min(containerW / STAGE_BOX.w, containerH / STAGE_BOX.h) * padding;
}

/** Centering offset (CSS px) for the scaled box inside the container. */
export function centerOffset(containerW: number, containerH: number, scale: number) {
  return {
    x: (containerW - STAGE_BOX.w * scale) / 2,
    y: (containerH - STAGE_BOX.h * scale) / 2,
  };
}
