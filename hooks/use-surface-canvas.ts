"use client";

import { type RefObject, useEffect, useRef } from "react";

import { drawSurface } from "@/lib/arc/render/compositor";
import { backingSize } from "@/lib/arc/render/dpr";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import type { SurfaceId } from "@/lib/arc/surfaces";

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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size the backing store to the canvas's real on-screen size × DPR, so the
    // surface paints at true device resolution at any zoom / on any display.
    // Read every frame (not via ResizeObserver): output pages scale the canvas
    // with a CSS `transform` (see `ScaleToFit`), which changes the visual size
    // getBoundingClientRect reports without ever changing the canvas's own
    // layout box — so a resize observer on the canvas never fires for it, and
    // the backing store would stay stuck at its unscaled (blurry) size.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const { w, h } = backingSize(rect.width || 1, rect.height || 1, dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };

    let raf = 0;
    const loop = (t: number) => {
      resize();
      // Native size is read live (not captured at effect-setup) so an operator
      // resizing the surface takes effect immediately, no remount needed.
      const surface = inputsRef.current.config.surfaceSizes[surfaceId];
      // Map native surface units onto the (DPR-scaled) backing store. drawComponent
      // save/restore preserves this base transform, so painters stay in native px.
      ctx.setTransform(canvas.width / surface.w, 0, 0, canvas.height / surface.h, 0, 0);
      drawSurface(ctx, surfaceId, inputsRef.current, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [surfaceId, canvasRef]);
}
