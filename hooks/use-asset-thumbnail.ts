"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getThumbnail,
  requestThumbnail,
  subscribeThumbnails,
  type ThumbnailState,
} from "@/lib/arc/thumbnails";

/**
 * The cached raster thumbnail for `src`, requesting it the first time the tile
 * is actually near the viewport. Returns null while one is being produced.
 *
 * `enabled` gates the request so a grid of a hundred assets only rasterises what
 * the operator can see.
 */
export function useAssetThumbnail(
  src: string,
  video: boolean,
  enabled: boolean,
): ThumbnailState | null {
  useEffect(() => {
    if (enabled) requestThumbnail(src, video);
  }, [src, video, enabled]);

  return useSyncExternalStore(
    subscribeThumbnails,
    () => getThumbnail(src),
    () => null,
  );
}

/**
 * Whether `ref`'s element is at or near the viewport. Stays true once seen, so
 * scrolling back and forth doesn't churn work that's already done.
 */
export function useInView(ref: React.RefObject<Element | null>, rootMargin = "300px"): boolean {
  // Without IntersectionObserver there's nothing to wait for, so start as seen.
  const [seen, setSeen] = useState(
    () => typeof window !== "undefined" && typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setSeen(true);
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, seen]);

  return seen;
}
