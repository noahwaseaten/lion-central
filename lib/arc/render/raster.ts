/**
 * Vector (SVG) rasterisation cache for the canvas compositor.
 *
 * `ctx.drawImage(svgImage, …)` does not blit a bitmap — it re-runs the whole
 * vector rasteriser whenever the browser's own raster cache misses. That cache
 * is keyed on the exact device-space draw size and holds only a handful of
 * entries, so once several path-heavy sponsor logos share the arc it misses on
 * essentially every frame. A megabyte of paths costs ~100–200 ms to rasterise,
 * which is what turns the 60 fps render loop into 5 fps.
 *
 * Fix: rasterise each vector once at the size it is actually drawn, keep the
 * result, and blit that instead. Bitmap blits are effectively free and don't
 * care about scale, so the loop stops rasterising altogether after warm-up.
 *
 * Raster sources (PNG/JPEG/WebP/video) are already decoded bitmaps and are
 * handed back untouched.
 */

/** Longest edge we will ever rasterise to. Above the arc's own native size. */
const MAX_EDGE = 2048;

/** Total cached pixels before the least-recently-drawn entries are dropped (~128 MB RGBA). */
const PIXEL_BUDGET = 32_000_000;

/**
 * Round a draw size up to a power-of-two long edge, preserving aspect.
 *
 * Buckets matter: draw sizes wobble by fractions of a pixel as the stage zooms
 * or the DPR changes, and re-rasterising on every wobble would defeat the whole
 * cache. Powers of two mean a source settles after a couple of steps, at a
 * resolution never worse than the size it is drawn at.
 */
export function rasterBucket(w: number, h: number): { w: number; h: number } {
  const long = Math.max(w, h);
  if (!Number.isFinite(long) || long <= 0) return { w: 0, h: 0 };
  const target = Math.min(MAX_EDGE, Math.max(64, 2 ** Math.ceil(Math.log2(long))));
  const k = target / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Entries whose combined pixels exceed `budget`, oldest-drawn first. */
export function overBudget<T extends { w: number; h: number; used: number }>(
  entries: [string, T][],
  budget = PIXEL_BUDGET,
): string[] {
  let total = 0;
  for (const [, e] of entries) total += e.w * e.h;
  if (total <= budget) return [];

  const drop: string[] = [];
  for (const [key, e] of [...entries].sort((a, b) => a[1].used - b[1].used)) {
    if (total <= budget) break;
    total -= e.w * e.h;
    drop.push(key);
  }
  return drop;
}

/** `src` points at a vector image, so drawing it costs a rasterisation. */
export function isVectorSrc(src: string): boolean {
  return /\.svg(?:[?#]|$)/i.test(src) || src.startsWith("data:image/svg");
}

type Raster = ImageBitmap | HTMLCanvasElement;

interface Entry {
  raster: Raster | null;
  /** Size of `raster`, 0 until the first one lands. */
  w: number;
  h: number;
  /** Long edge currently being produced, 0 when idle. Stops duplicate work. */
  pending: number;
  /** Monotonic draw counter, for LRU eviction. */
  used: number;
}

const cache = new Map<string, Entry>();
let tick = 0;

/**
 * Synchronous rasterisation blocks the frame, so at most one runs per animation
 * frame — a dozen heavy logos warm up over a dozen frames instead of freezing
 * the tab for several seconds on load. Self-throttling rather than metered by
 * the caller, so every painter gets the same protection.
 */
let syncBlocked = false;

function vectorKey(media: CanvasImageSource): string | null {
  if (typeof HTMLImageElement === "undefined") return null;
  if (!(media instanceof HTMLImageElement)) return null;
  const src = media.currentSrc || media.src;
  return src && isVectorSrc(src) ? src : null;
}

function release(entry: Entry): void {
  if (entry.raster && "close" in entry.raster) entry.raster.close();
  entry.raster = null;
  entry.w = 0;
  entry.h = 0;
}

function evict(): void {
  for (const key of overBudget([...cache.entries()])) {
    const entry = cache.get(key);
    if (!entry) continue;
    release(entry);
    cache.delete(key);
  }
}

/** Rasterise straight onto a canvas at the target size — crisp at any scale, but blocking. */
function rasterizeSync(img: HTMLImageElement, want: { w: number; h: number }): HTMLCanvasElement | null {
  if (syncBlocked) return null;
  syncBlocked = true;
  requestAnimationFrame(() => {
    syncBlocked = false;
  });
  const canvas = document.createElement("canvas");
  canvas.width = want.w;
  canvas.height = want.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, want.w, want.h);
  return canvas;
}

async function produce(img: HTMLImageElement, want: { w: number; h: number }): Promise<Raster | null> {
  if (!img.naturalWidth) return null;
  // Downscaling can go through createImageBitmap, which rasterises off the main
  // thread. Upscaling can't: it would resample the intrinsic-size raster and
  // blur, so those go through the (budgeted) canvas path to re-run the vector.
  if (want.w <= img.naturalWidth && typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(img, {
        resizeWidth: want.w,
        resizeHeight: want.h,
        resizeQuality: "high",
      });
    } catch {
      // Fall through to the canvas path.
    }
  }
  return rasterizeSync(img, want);
}

function request(key: string, img: HTMLImageElement, want: { w: number; h: number }): Entry {
  let entry = cache.get(key);
  if (!entry) {
    entry = { raster: null, w: 0, h: 0, pending: 0, used: ++tick };
    cache.set(key, entry);
  }
  if (entry.pending >= want.w) return entry;

  const target = entry;
  target.pending = want.w;
  void produce(img, want)
    .then((raster) => {
      if (!raster) return;
      // A larger raster may have landed first; keep the better one.
      if (target.w >= want.w) {
        if ("close" in raster) raster.close();
        return;
      }
      release(target);
      target.raster = raster;
      target.w = want.w;
      target.h = want.h;
      evict();
    })
    .catch(() => {})
    .finally(() => {
      if (target.pending === want.w) target.pending = 0;
    });

  return entry;
}

/**
 * A ready-to-blit source for `media` at the given device-pixel size.
 *
 * Returns `media` unchanged for raster images and video. For vectors it returns
 * a cached bitmap, or `null` while the first one is still being produced — the
 * caller should simply skip drawing that frame.
 */
export function rasterSourceFor(
  media: CanvasImageSource,
  deviceW: number,
  deviceH: number,
): CanvasImageSource | null {
  const key = vectorKey(media);
  if (!key) return media;

  const want = rasterBucket(deviceW, deviceH);
  if (!want.w) return null;

  const entry = cache.get(key);
  if (entry) {
    entry.used = ++tick;
    if (entry.raster && entry.w >= want.w && entry.h >= want.h) return entry.raster;
  }
  return request(key, media as HTMLImageElement, want).raster;
}

/** Drop every cached raster. Exposed for tests and hot-reload safety. */
export function clearRasterCache(): void {
  for (const entry of cache.values()) release(entry);
  cache.clear();
}
