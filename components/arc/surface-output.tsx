"use client";

import { useRef } from "react";

import { useArcInputs } from "@/hooks/use-arc-inputs";
import { useSurfaceCanvas } from "@/hooks/use-surface-canvas";
import { getSurface, type SurfaceId } from "@/lib/arc/surfaces";

import { ScaleToFit } from "./scale-to-fit";

/**
 * Clean, full-screen render of a single arc surface at native resolution,
 * auto-scaled to the screen. This is what you point a physical LED / projector
 * at — no controls, driven by the shared compositor + cross-tab state.
 */
export function SurfaceOutput({ surfaceId }: { surfaceId: SurfaceId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inputs = useArcInputs();
  useSurfaceCanvas(surfaceId, ref, inputs);

  const surface = getSurface(surfaceId);
  if (!surface) return null;

  return (
    <ScaleToFit width={surface.w} height={surface.h}>
      <canvas ref={ref} className="block h-full w-full" />
    </ScaleToFit>
  );
}
