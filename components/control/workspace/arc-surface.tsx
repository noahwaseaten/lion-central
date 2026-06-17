"use client";

import { useRef } from "react";

import { useSurfaceCanvas } from "@/hooks/use-surface-canvas";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import type { SurfaceId } from "@/lib/arc/surfaces";

/**
 * One arc surface, live-composited to a native-resolution canvas and displayed at
 * `cssW × cssH`. Pure presentation — positioning is handled by the stage.
 */
export function ArcSurface({
  surfaceId,
  inputs,
  cssW,
  cssH,
  className,
  style,
}: {
  surfaceId: SurfaceId;
  inputs: SurfaceInputs;
  cssW: number;
  cssH: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useSurfaceCanvas(surfaceId, ref, inputs);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ ...style, width: cssW, height: cssH }}
    />
  );
}
