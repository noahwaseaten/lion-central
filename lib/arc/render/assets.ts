/**
 * Browser-only asset cache for the canvas compositor. Images and videos are
 * loaded once per `src` and reused across every animation frame. Painters check
 * `naturalWidth` / `videoWidth` to know when an asset is ready to draw.
 */

const images = new Map<string, HTMLImageElement>();
const videos = new Map<string, HTMLVideoElement>();

/** Get (and lazily start loading) an image. Returns null off the main thread. */
export function getImage(src: string): HTMLImageElement | null {
  if (!src || typeof document === "undefined") return null;
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    images.set(src, img);
  }
  return img;
}

/** Get (and lazily start playing) a muted-by-default video element. */
export function getVideo(
  src: string,
  opts: { loop: boolean; muted: boolean },
): HTMLVideoElement | null {
  if (!src || typeof document === "undefined") return null;
  let v = videos.get(src);
  if (!v) {
    v = document.createElement("video");
    v.src = src;
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    v.autoplay = true;
    videos.set(src, v);
  }
  v.loop = opts.loop;
  v.muted = opts.muted;
  if (v.paused) void v.play().catch(() => {});
  return v;
}
