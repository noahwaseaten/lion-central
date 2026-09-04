/**
 * Browser-only asset cache for the canvas compositor. Images and videos are
 * loaded once per `src` and reused across every animation frame. Painters check
 * `naturalWidth` / `videoWidth` to know when an asset is ready to draw.
 */

interface CachedImage {
  el: HTMLImageElement;
  retries: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

const images = new Map<string, CachedImage>();
const videos = new Map<string, HTMLVideoElement>();

/** A blip (server briefly unready, a dropped request) shouldn't leave a logo permanently blank — keep retrying with backoff instead of giving up after the first failure. */
const MAX_IMAGE_RETRIES = 6;
const RETRY_BASE_MS = 1000;

function scheduleImageRetry(src: string, cached: CachedImage): void {
  if (cached.retries >= MAX_IMAGE_RETRIES || cached.retryTimer) return;
  cached.retries += 1;
  const delay = RETRY_BASE_MS * 2 ** (cached.retries - 1);
  cached.retryTimer = setTimeout(() => {
    cached.retryTimer = null;
    // Cache-bust: a plain `src` reassignment is a no-op if the browser still
    // has the failed request cached, so the retry would never actually hit
    // the network again.
    const sep = src.includes("?") ? "&" : "?";
    cached.el.src = `${src}${sep}retry=${cached.retries}`;
  }, delay);
}

/** Get (and lazily start loading) an image. Returns null off the main thread. */
export function getImage(src: string): HTMLImageElement | null {
  if (!src || typeof document === "undefined") return null;
  let cached = images.get(src);
  if (!cached) {
    const el = new Image();
    el.crossOrigin = "anonymous";
    const entry: CachedImage = { el, retries: 0, retryTimer: null };
    el.onerror = () => scheduleImageRetry(src, entry);
    el.onload = () => {
      // A late-landing retry can follow a since-succeeded load; nothing to do.
      entry.retries = 0;
    };
    el.src = src;
    images.set(src, entry);
    cached = entry;
  }
  return cached.el;
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
