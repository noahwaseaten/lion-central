"use client";

import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import { getSurface, type SurfaceId } from "@/lib/arc/surfaces";

import { NumberFlowClock } from "./number-flow-clock";

/**
 * DOM overlay for components that can't be drawn on the canvas — currently the
 * NumberFlow clock. Positioned in display pixels over the surface canvas, so it
 * lines up with (and scales the same as) the composited output.
 */
export function SurfaceClockOverlay({
  surfaceId,
  inputs,
  displayW,
  displayH,
}: {
  surfaceId: SurfaceId;
  inputs: SurfaceInputs;
  displayW: number;
  displayH: number;
}) {
  const surface = getSurface(surfaceId);
  if (!surface) return null;
  const components = inputs.config.surfaces[surfaceId] ?? [];

  return (
    <div className="pointer-events-none absolute inset-0">
      {components.map((comp) => {
        if (comp.content.type !== "clock" || !comp.content.numberFlow) return null;
        const w = comp.rect.w * displayW;
        const h = comp.rect.h * displayH;
        const chars = inputs.clock.ms >= 3600_000 ? 7 : 5;
        const fontPx = Math.max(8, Math.min(h * 0.7, (w * 0.92) / (chars * 0.6)));
        return (
          <div
            key={comp.id}
            className="absolute flex items-center justify-center"
            style={{
              left: comp.rect.x * displayW,
              top: comp.rect.y * displayH,
              width: w,
              height: h,
            }}
          >
            <NumberFlowClock
              ms={inputs.clock.ms}
              running={inputs.clock.running}
              direction={inputs.clock.direction}
              fontPx={fontPx}
            />
          </div>
        );
      })}
    </div>
  );
}
