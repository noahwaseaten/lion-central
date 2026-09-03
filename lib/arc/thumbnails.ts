"use client";

import { isVectorSrc } from "./render/raster";

/**
 * Raster thumbnail cache for the media library grid.
 *
 * The library is full of large vector logos. An `<img src="…svg">` in a tile is
 * a full vector document the browser re-rasterises whenever its layout box
 * changes size — so a grid of them turns any resize, reflow or panel animation
 * into a multi-second stall, and the tab drops to a few frames a second.
 *
 * So the grid never renders source files. Each asset is rasterised once, off the
 * critical path and a couple at a time, into a small fixed-size bitmap that the
 * tiles render instead. The result is cached for the life of the page, so
 * reopening the library is instant.
 */

/** Rasterised edge, in device pixels — 2× the largest tile, for retina. */
const THUMB_EDGE = 192;

/** Concurrent rasterisations. Small: each one can be a megabyte of paths. */
const MAX_ACTIVE = 2;

export type ThumbnailState =
  | { status: "ready"; src: string; w: number; h: number }
  | { status: "error" };

/**
 * Thumbnail pixel size for a source of `w`×`h`.
 *
 * Rasters are only ever scaled down — enlarging one just wastes memory on
 * blur. Vectors are rasterised to fill the box whatever their intrinsic size,
 * since re-running the vector at a larger size is what keeps them crisp.
 */
export function thumbSize(w: number, h: number, vector: boolean): { w: number; h: number } {
  const long = Math.max(w, h);
  if (!Number.isFinite(long) || long <= 0) return { w: 0, h: 0 };
  const k = vector ? THUMB_EDGE / long : Math.min(1, THUMB_EDGE / long);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

const cache = new Map<string, ThumbnailState>();
const queued = new Set<string>();
const listeners = new Set<() => void>();
const pending: { src: string; video: boolean }[] = [];
let active = 0;

function emit(): void {
  for (const fn of listeners) fn();
}

export function subscribeThumbnails(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The cached thumbnail for `src`, or null if it hasn't been produced yet. */
export function getThumbnail(src: string): ThumbnailState | null {
  return cache.get(src) ?? null;
}

/** Queue `src` for rasterisation. Safe to call every render; repeats are ignored. */
export function requestThumbnail(src: string, video: boolean): void {
  if (!src || cache.has(src) || queued.has(src)) return;
  queued.add(src);
  pending.push({ src, video });
  pump();
}

/** Drop a cached thumbnail — call when the underlying asset is deleted. */
export function forgetThumbnail(src: string): void {
  const entry = cache.get(src);
  if (entry?.status === "ready") URL.revokeObjectURL(entry.src);
  cache.delete(src);
  queued.delete(src);
}

function pump(): void {
  while (active < MAX_ACTIVE && pending.length > 0) {
    const job = pending.shift();
    if (!job) return;
    active += 1;
    void rasterise(job.src, job.video)
      .then((state) => cache.set(job.src, state))
      .catch(() => cache.set(job.src, { status: "error" }))
      .finally(() => {
        active -= 1;
        queued.delete(job.src);
        emit();
        pump();
      });
  }
}

interface Frame {
  source: CanvasImageSource;
  w: number;
  h: number;
  release: () => void;
}

async function rasterise(src: string, video: boolean): Promise<ThumbnailState> {
  const frame = video ? await videoFrame(src) : await imageFrame(src);
  try {
    const size = thumbSize(frame.w, frame.h, !video && isVectorSrc(src));
    if (!size.w) return { status: "error" };

    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { status: "error" };
    ctx.drawImage(frame.source, 0, 0, size.w, size.h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) return { status: "error" };
    return { status: "ready", src: URL.createObjectURL(blob), w: size.w, h: size.h };
  } finally {
    frame.release();
  }
}

function imageFrame(src: string): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) return reject(new Error("no intrinsic size"));
      resolve({ source: img, w, h, release: () => { img.src = ""; } });
    };
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}

function videoFrame(src: string): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.1, video.duration || 0.1);
    };
    video.onseeked = () => {
      const { videoWidth: w, videoHeight: h } = video;
      if (!w || !h) return reject(new Error("no video size"));
      resolve({ source: video, w, h, release: () => { video.src = ""; } });
    };
    video.onerror = () => reject(new Error("load failed"));
    video.src = src;
  });
}
