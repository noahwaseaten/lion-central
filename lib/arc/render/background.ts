import type { BackgroundConfig } from "../content";
import { arrangePlacements, boundingBox, type SurfacePlacement } from "../stage-layout";
import type { SurfaceId, SurfaceSizes } from "../surfaces";
import { getVideo } from "./assets";

/**
 * The source-video crop for one surface, so that "cover"-fitting the video
 * across the *whole* arc bounding box and then cropping to this surface's
 * placement makes every surface show its correct slice of one continuous
 * picture — not four independent copies of the whole clip.
 */
export function videoSourceRect(
  placement: SurfacePlacement,
  box: { w: number; h: number },
  videoW: number,
  videoH: number,
): { sx: number; sy: number; sw: number; sh: number } | null {
  if (videoW <= 0 || videoH <= 0 || box.w <= 0 || box.h <= 0) return null;
  const scale = Math.max(box.w / videoW, box.h / videoH);
  const offX = (box.w - videoW * scale) / 2;
  const offY = (box.h - videoH * scale) / 2;

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const sx = clamp((placement.x - offX) / scale, 0, videoW);
  const sy = clamp((placement.y - offY) / scale, 0, videoH);
  const sw = clamp(placement.w / scale, 0, videoW - sx);
  const sh = clamp(placement.h / scale, 0, videoH - sy);
  if (sw <= 0 || sh <= 0) return null;
  return { sx, sy, sw, sh };
}

const SYNC_CHECK_MS = 1000;
const SYNC_TOLERANCE_S = 0.25;

/** Where a looping video's playback position should be at wall-clock `nowMs`, for a clip of `durationS`. */
export function syncTarget(nowMs: number, durationS: number): number {
  return (nowMs / 1000) % durationS;
}

const lastSyncCheck = new WeakMap<HTMLVideoElement, number>();

/**
 * Nudges a looping background video back toward its wall-clock position
 * (checked ~once/sec, corrected only past a tolerance) so the same clip stays
 * roughly in lockstep across separately-loaded output tabs — within one tab,
 * every surface already shares the one cached `<video>` element (see
 * `getVideo`), so this only matters across tabs/windows.
 */
function keepVideoSynced(video: HTMLVideoElement): void {
  const now = Date.now();
  if ((lastSyncCheck.get(video) ?? 0) + SYNC_CHECK_MS > now) return;
  lastSyncCheck.set(video, now);
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const target = syncTarget(now, video.duration);
  if (Math.abs(video.currentTime - target) > SYNC_TOLERANCE_S) video.currentTime = target;
}

/**
 * Paint one rectangle of the shared background — a solid fill, or the matching
 * crop of the looping arc-wide video — at an arbitrary spot on the surface.
 *
 * `surfaceX/Y` locate the rect within the SURFACE's own coordinate space (used
 * to work out which part of the video to sample); `destX/Y` are where to
 * actually draw it under the CURRENT canvas transform. They're only the same
 * when called with no transform applied (see `paintBackground` below) — a
 * caller drawing inside an already-translated/clipped region (e.g. the feed's
 * edge fade, redrawing a strip of real background over its own content) passes
 * the untranslated surface position separately from the local destination.
 */
export function paintBackgroundSlice(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundConfig,
  surfaceId: SurfaceId,
  sizes: SurfaceSizes,
  surfaceX: number,
  surfaceY: number,
  destX: number,
  destY: number,
  w: number,
  h: number,
): void {
  const fallback = () => {
    ctx.fillStyle = bg.color;
    ctx.fillRect(destX, destY, w, h);
  };
  if (bg.mode !== "video" || !bg.videoSrc) return fallback();

  const video = getVideo(bg.videoSrc, { loop: true, muted: true });
  if (!video || video.videoWidth === 0) return fallback();
  keepVideoSynced(video);

  const placements = arrangePlacements(sizes);
  const placement = placements.find((pl) => pl.id === surfaceId);
  if (!placement) return fallback();
  const box = boundingBox(placements);
  const src = videoSourceRect(
    { id: surfaceId, x: placement.x + surfaceX, y: placement.y + surfaceY, w, h },
    box,
    video.videoWidth,
    video.videoHeight,
  );
  if (!src) return fallback();

  ctx.drawImage(video, src.sx, src.sy, src.sw, src.sh, destX, destY, w, h);
}

/** Paint this surface's slice of the shared background — a solid fill, or its crop of the looping arc-wide video. */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundConfig,
  surfaceId: SurfaceId,
  w: number,
  h: number,
  sizes: SurfaceSizes,
): void {
  paintBackgroundSlice(ctx, bg, surfaceId, sizes, 0, 0, 0, 0, w, h);
}
