import type { NormRect } from "./layout-model";
import { defaultSurfaceSizes, type SurfaceId, type SurfaceSizes } from "./surfaces";

/**
 * Geometry for the 2D arc stage. The arc is laid out as an inverted-U in a single
 * native-px bounding box (origin top-left): the clock sits on top, the top bar
 * below it, and the two legs hang from the bar's ends. Everything here is pure so
 * the stage component and its component overlays derive from one source.
 *
 * Each surface's resolution is operator-editable (`ArcConfig.surfaceSizes`), so
 * placement is always computed from a `SurfaceSizes` table rather than baked-in
 * constants — `arrangePlacements` is what every renderer (stage, canvases,
 * `/output` pages) calls to stay in sync with a resize.
 */

export interface SurfacePlacement {
  id: SurfaceId;
  /** Native-px position within the arrangement's bounding box. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Arranges the four surfaces as the inverted-U at the given per-surface sizes. */
export function arrangePlacements(sizes: SurfaceSizes): SurfacePlacement[] {
  const c = sizes.clock, t = sizes.topbar, l = sizes["leg-left"], r = sizes["leg-right"];
  return [
    { id: "clock", x: (t.w - c.w) / 2, y: 0, w: c.w, h: c.h },
    { id: "topbar", x: 0, y: c.h, w: t.w, h: t.h },
    { id: "leg-left", x: 0, y: c.h + t.h, w: l.w, h: l.h },
    { id: "leg-right", x: t.w - r.w, y: c.h + t.h, w: r.w, h: r.h },
  ];
}

/** The bounding box that contains every placement (native px). */
export function boundingBox(placements: SurfacePlacement[]): { w: number; h: number } {
  return {
    w: Math.max(...placements.map((p) => p.x + p.w)),
    h: Math.max(...placements.map((p) => p.y + p.h)),
  };
}

export function placementMap(placements: SurfacePlacement[]): Map<SurfaceId, SurfacePlacement> {
  return new Map(placements.map((p) => [p.id, p]));
}

/** Default (native-resolution) arrangement — used before a config loads, and by tests. */
export const SURFACE_PLACEMENTS: SurfacePlacement[] = arrangePlacements(defaultSurfaceSizes());
export const STAGE_BOX = boundingBox(SURFACE_PLACEMENTS);

const DEFAULT_PLACEMENT_BY_ID = placementMap(SURFACE_PLACEMENTS);

export function getPlacement(id: SurfaceId): SurfacePlacement | undefined {
  return DEFAULT_PLACEMENT_BY_ID.get(id);
}

export interface NativeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A component's rect in bounding-box native coordinates (surface offset + norm × size). */
export function componentRectNative(
  surfaceId: SurfaceId,
  rect: NormRect,
  placements: SurfacePlacement[] = SURFACE_PLACEMENTS,
): NativeRect | undefined {
  const p = placementMap(placements).get(surfaceId);
  if (!p) return undefined;
  return { x: p.x + rect.x * p.w, y: p.y + rect.y * p.h, w: rect.w * p.w, h: rect.h * p.h };
}

/** The pixel size of one component on its (possibly resized) surface, for aspect-ratio previews. */
export function componentPixelSize(
  surfaceId: SurfaceId,
  rect: NormRect,
  sizes: SurfaceSizes = defaultSurfaceSizes(),
): { w: number; h: number } {
  const s = sizes[surfaceId];
  if (!s) return { w: 1, h: 1 };
  return { w: Math.max(1, rect.w * s.w), h: Math.max(1, rect.h * s.h) };
}

/**
 * Uniform scale (native px → CSS px) that fits `box` into the given container,
 * leaving `padding` of slack (0–1). Returns 0 for a degenerate container.
 */
export function fitScale(
  containerW: number,
  containerH: number,
  padding = 0.9,
  box: { w: number; h: number } = STAGE_BOX,
): number {
  if (containerW <= 0 || containerH <= 0) return 0;
  return Math.min(containerW / box.w, containerH / box.h) * padding;
}

/** Centering offset (CSS px) for `box`, scaled, inside the container. */
export function centerOffset(
  containerW: number,
  containerH: number,
  scale: number,
  box: { w: number; h: number } = STAGE_BOX,
) {
  return {
    x: (containerW - box.w * scale) / 2,
    y: (containerH - box.h * scale) / 2,
  };
}
