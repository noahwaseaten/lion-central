"use client";

import { type RefObject, useEffect, useRef } from "react";

import { drawSurface } from "@/lib/arc/render/compositor";
import { backingSize } from "@/lib/arc/render/dpr";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import type { SurfaceId } from "@/lib/arc/surfaces";

/**
 * Size a visible canvas to its real on-screen size × DPR and paint one frame
 * of `surfaceId` via the shared compositor. Every caller wraps this in
 * try/catch — a bad frame (an image/video mid-load producing a transient bad
 * value) must never be allowed to throw, since an uncaught throw from inside
 * a requestAnimationFrame callback stops that rAF loop for good: the line
 * that reschedules the next frame is never reached.
 */
function drawFrame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  surfaceId: SurfaceId,
  inputs: SurfaceInputs,
  t: number,
): void {
  // Read every frame (not via ResizeObserver): output pages scale the canvas
  // with a CSS `transform` (see `ScaleToFit`), which changes the visual size
  // getBoundingClientRect reports without ever changing the canvas's own
  // layout box — so a resize observer on the canvas never fires for it, and
  // the backing store would stay stuck at its unscaled (blurry) size.
  const rect = canvas.getBoundingClientRect();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const { w, h } = backingSize(rect.width || 1, rect.height || 1, dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  // Native size is read live (not captured at effect-setup) so an operator
  // resizing the surface takes effect immediately, no remount needed.
  const surface = inputs.config.surfaceSizes[surfaceId];
  // Map native surface units onto the (DPR-scaled) backing store. drawComponent
  // save/restore preserves this base transform, so painters stay in native px.
  ctx.setTransform(canvas.width / surface.w, 0, 0, canvas.height / surface.h, 0, 0);
  drawSurface(ctx, surfaceId, inputs, t);
}

/**
 * Drives a single visible canvas: sizes it to the surface's native resolution
 * and runs a requestAnimationFrame loop drawing it via the shared compositor.
 * `inputs` is read through a ref so the loop always sees the latest data
 * without resubscribing every frame.
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

    let raf = 0;
    const loop = (t: number) => {
      try {
        drawFrame(canvas, ctx, surfaceId, inputsRef.current, t);
      } catch {
        // A bad frame must not kill the loop — see drawFrame's doc comment.
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [surfaceId, canvasRef]);
}

export interface SurfaceCanvasEntry {
  surfaceId: SurfaceId;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * Same as `useSurfaceCanvas`, but drives every entry's canvas from one shared
 * requestAnimationFrame loop instead of one loop per canvas. Used by the
 * combined "/output/all" view: 4 independent loops each doing their own
 * layout read is real per-frame overhead that a single-surface output never
 * pays, and it's cheap insurance against stalling on a weaker "media PC"
 * driving an OBS browser source.
 */
export function useSurfaceCanvasGroup(entries: SurfaceCanvasEntry[], inputs: SurfaceInputs): void {
  const inputsRef = useRef(inputs);
  // eslint-disable-next-line react-hooks/refs -- mirror latest inputs into a ref for the rAF loop
  inputsRef.current = inputs;

  const entriesRef = useRef(entries);
  // eslint-disable-next-line react-hooks/refs -- read the latest canvas list every frame without resubscribing
  entriesRef.current = entries;

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      for (const { surfaceId, canvasRef } of entriesRef.current) {
        const canvas = canvasRef.current;
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        try {
          drawFrame(canvas, ctx, surfaceId, inputsRef.current, t);
        } catch {
          // A bad frame on one surface must not stop the others from drawing.
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
