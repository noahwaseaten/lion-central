"use client";

import { useRef } from "react";

import { useAssetThumbnail, useInView } from "@/hooks/use-asset-thumbnail";
import { assetDisplayName, isVideoAsset } from "@/lib/arc/assets-shared";
import { cn } from "@/lib/utils";

/**
 * A logo preview anywhere in the control UI.
 *
 * Always renders the cached raster thumbnail rather than the source file — the
 * library holds multi-megabyte vector logos, and pointing an `<img>` at one
 * makes the browser re-rasterise the whole document on every layout change.
 */
export function AssetThumb({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const thumb = useAssetThumbnail(src, isVideoAsset(src), inView);

  return (
    <span ref={ref} className={cn("grid shrink-0 place-items-center overflow-hidden", className)}>
      {thumb?.status === "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element -- cached raster thumbnail, not a build asset
        <img
          src={thumb.src}
          alt={assetDisplayName(src)}
          width={thumb.w}
          height={thumb.h}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span className="size-full rounded bg-muted" />
      )}
    </span>
  );
}
