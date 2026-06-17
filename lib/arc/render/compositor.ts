import type { Rect } from "./zones";
import { getSurface, type SurfaceId } from "../surfaces";
import type { SurfaceInputs } from "./inputs";
import { drawComponent } from "./zones";

export type { SurfaceInputs };

/**
 * Draw a complete arc surface onto a 2D canvas context at native resolution.
 * Shared by the workspace stage and the output routes, so the editor preview and
 * the physical output never diverge.
 *
 * `ctx` is expected to be sized to the surface's native dimensions. Components are
 * drawn in array order — the last one in the list paints on top.
 */
export function drawSurface(
  ctx: CanvasRenderingContext2D,
  surfaceId: SurfaceId,
  inputs: SurfaceInputs,
  tMs: number,
): void {
  const surface = getSurface(surfaceId);
  if (!surface) return;

  // Arc background (the physical arc is white).
  ctx.fillStyle = inputs.config.background || "#ffffff";
  ctx.fillRect(0, 0, surface.w, surface.h);

  const components = inputs.config.surfaces[surfaceId] ?? [];
  for (const comp of components) {
    const rect: Rect = {
      x: comp.rect.x * surface.w,
      y: comp.rect.y * surface.h,
      w: comp.rect.w * surface.w,
      h: comp.rect.h * surface.h,
    };
    if (rect.w < 1 || rect.h < 1) continue;
    drawComponent(ctx, rect, comp.content, inputs, tMs, comp.id);
  }
}
