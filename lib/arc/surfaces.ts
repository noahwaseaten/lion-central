import { CLOCK, LEG, TOP_BAR } from "./layout";

/** A physical, separately-driven surface of the arc. */
export type SurfaceId = "clock" | "topbar" | "leg-left" | "leg-right";

export interface Surface {
  id: SurfaceId;
  label: string;
  /** Native resolution, in px. */
  w: number;
  h: number;
}

/**
 * The arc's surfaces and their native dimensions. Each surface is an open canvas
 * the operator composes with components (see `layout-model.ts`); geometry comes
 * from `layout.ts` so dimensions stay in one place.
 */
export const SURFACES: Surface[] = [
  { id: "clock", label: "Clock (top)", w: CLOCK.w, h: CLOCK.h },
  { id: "topbar", label: "Top bar", w: TOP_BAR.w, h: TOP_BAR.h },
  { id: "leg-left", label: "Left leg", w: LEG.w, h: LEG.h },
  { id: "leg-right", label: "Right leg", w: LEG.w, h: LEG.h },
];

export const SURFACE_IDS = SURFACES.map((s) => s.id);

export function getSurface(id: SurfaceId): Surface | undefined {
  return SURFACES.find((s) => s.id === id);
}

export function isSurfaceId(value: string): value is SurfaceId {
  return (SURFACE_IDS as string[]).includes(value);
}
