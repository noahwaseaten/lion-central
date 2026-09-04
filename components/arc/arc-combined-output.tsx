"use client";

import { type RefObject, useRef } from "react";

import { useArcInputs } from "@/hooks/use-arc-inputs";
import { type SurfaceCanvasEntry, useSurfaceCanvasGroup } from "@/hooks/use-surface-canvas";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import { arrangePlacements, boundingBox, type SurfacePlacement } from "@/lib/arc/stage-layout";
import type { SurfaceId } from "@/lib/arc/surfaces";

import { ScaleToFit } from "./scale-to-fit";
import { SurfaceClockOverlay } from "./surface-clock-overlay";

/**
 * Clean, full-screen render of every arc surface at once, arranged as the
 * physical inverted-U — for the (common) case where the media team can only
 * point one output at the whole arc instead of driving each part separately.
 * Each part's actual resolution is whatever's set for it in the workspace
 * canvas (see `ArcStage`'s resize handles) — this page just lays them out.
 *
 * All 4 canvases share one requestAnimationFrame loop (`useSurfaceCanvasGroup`)
 * instead of each running its own — see that hook's doc comment.
 */
export function ArcCombinedOutput() {
  const inputs = useArcInputs();
  const placements = arrangePlacements(inputs.config.surfaceSizes);
  const box = boundingBox(placements);

  const clockRef = useRef<HTMLCanvasElement | null>(null);
  const topbarRef = useRef<HTMLCanvasElement | null>(null);
  const legLeftRef = useRef<HTMLCanvasElement | null>(null);
  const legRightRef = useRef<HTMLCanvasElement | null>(null);
  const refsBySurface: Record<SurfaceId, RefObject<HTMLCanvasElement | null>> = {
    clock: clockRef,
    topbar: topbarRef,
    "leg-left": legLeftRef,
    "leg-right": legRightRef,
  };

  const entries: SurfaceCanvasEntry[] = placements.map((p) => ({
    surfaceId: p.id,
    canvasRef: refsBySurface[p.id],
  }));
  useSurfaceCanvasGroup(entries, inputs);

  return (
    <ScaleToFit width={box.w} height={box.h}>
      <div className="relative" style={{ width: box.w, height: box.h }}>
        {placements.map((p) => (
          <SurfaceLayer key={p.id} placement={p} inputs={inputs} canvasRef={refsBySurface[p.id]} />
        ))}
      </div>
    </ScaleToFit>
  );
}

function SurfaceLayer({
  placement,
  inputs,
  canvasRef,
}: {
  placement: SurfacePlacement;
  inputs: SurfaceInputs;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <div
      className="absolute"
      style={{ left: placement.x, top: placement.y, width: placement.w, height: placement.h }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <SurfaceClockOverlay
        surfaceId={placement.id}
        inputs={inputs}
        displayW={placement.w}
        displayH={placement.h}
      />
    </div>
  );
}
