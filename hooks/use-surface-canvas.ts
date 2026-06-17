"use client";

import { type RefObject, useEffect, useRef } from "react";

import { drawSurface } from "@/lib/arc/render/compositor";
import { backingSize } from "@/lib/arc/render/dpr";
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size the backing store to the canvas's real on-screen size × DPR, so the
    // surface paints at true device resolution at any zoom / on any display.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const { w, h } = backingSize(rect.width || surface.w, rect.height || surface.h, dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    const loop = (t: number) => {
      // Map native surface units onto the (DPR-scaled) backing store. drawComponent
      // save/restore preserves this base transform, so painters stay in native px.
      ctx.setTransform(canvas.width / surface.w, 0, 0, canvas.height / surface.h, 0, 0);
      drawSurface(ctx, surfaceId, inputsRef.current, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [surfaceId, canvasRef]);
}
