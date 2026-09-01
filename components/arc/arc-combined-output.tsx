"use client";

import { useRef } from "react";

import { useArcInputs } from "@/hooks/use-arc-inputs";
import { useSurfaceCanvas } from "@/hooks/use-surface-canvas";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import { arrangePlacements, boundingBox, type SurfacePlacement } from "@/lib/arc/stage-layout";

import { ScaleToFit } from "./scale-to-fit";
import { SurfaceClockOverlay } from "./surface-clock-overlay";

/**
 * Clean, full-screen render of every arc surface at once, arranged as the
 * physical inverted-U — for the (common) case where the media team can only
 * point one output at the whole arc instead of driving each part separately.
 * Each part's actual resolution is whatever's set for it in the workspace
 * canvas (see `ArcStage`'s resize handles) — this page just lays them out.
 */
export function ArcCombinedOutput() {
  const inputs = useArcInputs();
  const placements = arrangePlacements(inputs.config.surfaceSizes);
  const box = boundingBox(placements);

  return (
    <ScaleToFit width={box.w} height={box.h}>
      <div className="relative" style={{ width: box.w, height: box.h }}>
        {placements.map((p) => (
          <SurfaceLayer key={p.id} placement={p} inputs={inputs} />
        ))}
      </div>
    </ScaleToFit>
  );
}

function SurfaceLayer({
  placement,
  inputs,
}: {
  placement: SurfacePlacement;
  inputs: SurfaceInputs;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useSurfaceCanvas(placement.id, ref, inputs);

  return (
    <div
      className="absolute"
      style={{ left: placement.x, top: placement.y, width: placement.w, height: placement.h }}
    >
      <canvas ref={ref} className="block h-full w-full" />
      <SurfaceClockOverlay
        surfaceId={placement.id}
        inputs={inputs}
        displayW={placement.w}
        displayH={placement.h}
      />
    </div>
  );
}
