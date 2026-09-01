import type { Rect } from "./zones";
import type { SurfaceId } from "../surfaces";
import { paintBackground } from "./background";
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
  const surface = inputs.config.surfaceSizes[surfaceId];
  if (!surface) return;

  paintBackground(ctx, inputs.config.background, surfaceId, surface.w, surface.h, inputs.config.surfaceSizes);

  const components = inputs.config.surfaces[surfaceId] ?? [];
  for (const comp of components) {
    const rect: Rect = {
      x: comp.rect.x * surface.w,
      y: comp.rect.y * surface.h,
      w: comp.rect.w * surface.w,
      h: comp.rect.h * surface.h,
    };
    if (rect.w < 1 || rect.h < 1) continue;
    drawComponent(ctx, rect, comp.content, inputs, tMs, comp.id, surfaceId);
  }

  // Background pulse: faint split-coloured wash painted AFTER components so it
  // composites uniformly over the whole surface (including feed edge-fades).
  const PULSE_MS = 2000;
  if (inputs.feed.lastArrivalMs > 0 && inputs.feed.lastArrivalSplit) {
    const pulseFade = Math.max(0, 1 - (tMs - inputs.feed.lastArrivalMs) / PULSE_MS);
    if (pulseFade > 0) {
      ctx.fillStyle = hexA(SPLIT_COLOR[inputs.feed.lastArrivalSplit], 0.09 * pulseFade);
      ctx.fillRect(0, 0, surface.w, surface.h);
    }
  }

  // Announcement overlay — topbar only, drawn last so it covers all components.
  if (inputs.announcement && surfaceId === "topbar") {
    paintAnnouncement(ctx, surface.w, surface.h, inputs.announcement, tMs);
  }
}

const ANN_FONT = "Inter, system-ui, sans-serif";
const CAUTION_YELLOW = "#facc15";
const CAUTION_BLACK = "#0a0a0a";
/** Diagonal-stripe repeat length (px) and crawl speed (px/ms) for the caution border. */
const STRIPE_PERIOD = 28;
const STRIPE_SPEED = 0.028;

function paintAnnouncement(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rec: AnnouncementRecord,
  tMs: number,
): void {
  const now = Date.now();
  const fadeIn  = Math.min(1, (now - rec.startedAt) / 200);
  const fadeOut = rec.permanent ? 1 : Math.min(1, (rec.endsAt - now) / 400);
  const alpha   = Math.min(fadeIn, fadeOut);
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Solid white panel (not the old solid-black one) so the message reads clearly
  // over whatever the bar was showing; the border draws on top of it.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const band = rec.urgent ? paintCautionBorder(ctx, w, h, tMs) : plainInset(w, h);

  const hasSub = !!rec.subtitle?.trim();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxW = w - band * 2.4;
  const titlePx = fitFont(ctx, rec.text, maxW, hasSub ? h * 0.38 : h * 0.48, "800");
  ctx.font = `800 ${titlePx}px ${ANN_FONT}`;
  ctx.fillStyle = CAUTION_BLACK;
  ctx.fillText(rec.text, w / 2, hasSub ? h * 0.42 : h / 2);

  if (hasSub) {
    const subPx = fitFont(ctx, rec.subtitle!, maxW, h * 0.2, "600");
    ctx.font = `600 ${subPx}px ${ANN_FONT}`;
    ctx.fillStyle = hexA(CAUTION_BLACK, 0.65);
    ctx.fillText(rec.subtitle!, w / 2, h * 0.72);
  }

  ctx.restore();
}

/**
 * A "keep out" caution-tape frame inset from the surface edges: diagonal
 * black/yellow stripes crawling slowly around the inside border. Returns the
 * band thickness so the caller can keep text clear of it.
 */
function paintCautionBorder(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): number {
  const band = Math.max(8, Math.min(w, h) * 0.09);
  const inset = Math.max(3, band * 0.22);
  const phase = ((tMs * STRIPE_SPEED) % STRIPE_PERIOD + STRIPE_PERIOD) % STRIPE_PERIOD;

  ctx.save();
  // Clip to the frame band only: outer rect minus inner rect (evenodd).
  const frame = new Path2D();
  frame.rect(inset, inset, w - inset * 2, h - inset * 2);
  frame.rect(inset + band, inset + band, w - inset * 2 - band * 2, h - inset * 2 - band * 2);
  ctx.clip(frame, "evenodd");

  ctx.fillStyle = CAUTION_BLACK;
  ctx.fillRect(0, 0, w, h);

  // Diagonal stripes sweep across the whole surface; the clip masks them to
  // the frame, so the same sweep reads as a continuous tape around all 4 sides.
  // Each parallelogram shifts by `h` from top (y=0) to bottom (y=h), so the sweep
  // has to start a full `h` further left than the frame — otherwise the strips
  // needed to reach the bottom-left corner never get drawn (band goes missing there).
  ctx.fillStyle = CAUTION_YELLOW;
  const stripeW = STRIPE_PERIOD / 2;
  for (let o = -h - STRIPE_PERIOD - phase; o < w + STRIPE_PERIOD; o += STRIPE_PERIOD) {
    ctx.beginPath();
    ctx.moveTo(o, 0);
    ctx.lineTo(o + stripeW, 0);
    ctx.lineTo(o + stripeW + h, h);
    ctx.lineTo(o + h, h);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  return band + inset;
}

/** No border for non-urgent announcements — just the text-clearance inset, no stroke. */
function plainInset(w: number, h: number): number {
  return Math.max(4, Math.min(w, h) * 0.06);
}
