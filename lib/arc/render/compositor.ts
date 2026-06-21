import type { Rect } from "./zones";
import { getSurface, type SurfaceId } from "../surfaces";
import type { AnnouncementRecord, SurfaceInputs } from "./inputs";
import { drawComponent, fitFont, hexA, SPLIT_COLOR } from "./zones";

export type { SurfaceInputs };

/**
 * Draw a complete arc surface onto a 2D canvas context at native resolution.
 * Shared by the workspace stage and the output routes, so the editor preview and
 * the physical output never diverge.
 *
 * `ctx` is expected to map native surface units onto its backing store — the caller
 * sets the base transform (see `useSurfaceCanvas`). Components are
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

  // Background pulse: faint split-coloured wash that decays over 2 s when a new athlete arrives.
  const PULSE_MS = 2000;
  if (inputs.feed.lastArrivalMs > 0 && inputs.feed.lastArrivalSplit) {
    const pulseFade = Math.max(0, 1 - (tMs - inputs.feed.lastArrivalMs) / PULSE_MS);
    if (pulseFade > 0) {
      ctx.fillStyle = hexA(SPLIT_COLOR[inputs.feed.lastArrivalSplit], 0.09 * pulseFade);
      ctx.fillRect(0, 0, surface.w, surface.h);
    }
  }

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

  // Announcement overlay — drawn last so it covers all components.
  if (inputs.announcement) {
    paintAnnouncement(ctx, surface.w, surface.h, inputs.announcement);
  }
}

const ANN_FONT = "Inter, system-ui, sans-serif";

function paintAnnouncement(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rec: AnnouncementRecord,
): void {
  const now = Date.now();
  const fadeIn  = Math.min(1, (now - rec.startedAt) / 200);
  const fadeOut = Math.min(1, (rec.endsAt - now) / 400);
  const alpha   = Math.min(fadeIn, fadeOut);
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);

  const hasSub = !!rec.subtitle?.trim();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const titlePx = fitFont(ctx, rec.text, w * 0.88, hasSub ? h * 0.44 : h * 0.56, "800");
  ctx.font = `800 ${titlePx}px ${ANN_FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(rec.text, w / 2, hasSub ? h * 0.42 : h / 2);

  if (hasSub) {
    const subPx = fitFont(ctx, rec.subtitle!, w * 0.82, h * 0.22, "500");
    ctx.font = `500 ${subPx}px ${ANN_FONT}`;
    ctx.fillStyle = hexA("#ffffff", 0.6);
    ctx.fillText(rec.subtitle!, w / 2, h * 0.72);
  }

  ctx.restore();
}
