"use client";

import { type RefObject, useEffect, useRef } from "react";

import { drawSurface } from "@/lib/arc/render/compositor";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import { getSurface, type SurfaceId } from "@/lib/arc/surfaces";

/**
 * Drives a visible canvas: sizes it to the surface's native resolution and runs
 * a requestAnimationFrame loop drawing the surface via the shared compositor.
 * `inputs` is read through a ref so the loop always sees the latest data without
 * resubscribing every frame.
 */
export function useSurfaceCanvas(
  surfaceId: SurfaceId,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  inputs: SurfaceInputs,
): void {
  const inputsRef = useRef(inputs);
  // eslint-disable-next-line react-hooks/refs -- mirror latest inputs into a ref for the rAF loop
  inputsRef.current = inputs;

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = getSurface(surfaceId);
    if (!canvas || !surface) return;

    canvas.width = surface.w;
    canvas.height = surface.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const loop = (t: number) => {
      drawSurface(ctx, surfaceId, inputsRef.current, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [surfaceId, canvasRef]);
}
