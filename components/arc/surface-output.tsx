"use client";

import { useRef } from "react";

import { useArcInputs } from "@/hooks/use-arc-inputs";
import { useSurfaceCanvas } from "@/hooks/use-surface-canvas";
import { getSurface, type SurfaceId } from "@/lib/arc/surfaces";

import { ScaleToFit } from "./scale-to-fit";
import { SurfaceClockOverlay } from "./surface-clock-overlay";
import { OutputGuides } from "./output-guides";

/**
 * Clean, full-screen render of a single arc surface at native resolution,
 * auto-scaled to the screen. This is what you point a physical LED / projector
 * at — no controls, driven by the shared compositor + cross-tab state.
 */
export function SurfaceOutput({ surfaceId }: { surfaceId: SurfaceId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inputs = useArcInputs();
  useSurfaceCanvas(surfaceId, ref, inputs);

  // Native size is operator-editable (see the workspace's canvas), so read the
  // live value rather than the static default — the label still comes from
  // `getSurface` since that never changes.
  const label = getSurface(surfaceId)?.label;
  const surface = inputs.config.surfaceSizes[surfaceId];
  if (!surface || !label) return null;

  return (
    <ScaleToFit width={surface.w} height={surface.h}>
      <div className="relative h-full w-full">
        <canvas ref={ref} className="block h-full w-full" />
        <SurfaceClockOverlay
          surfaceId={surfaceId}
          inputs={inputs}
          displayW={surface.w}
          displayH={surface.h}
        />
        <OutputGuides label={label} w={surface.w} h={surface.h} />
      </div>
    </ScaleToFit>
  );
}
