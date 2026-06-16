"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Renders a fixed design surface (`width`×`height`) and uniformly scales it to
 * fit the available space, centered and letterboxed on white. Pixel-perfect
 * proportions on any screen or projector.
 */
export function ScaleToFit({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setScale(Math.min(el.clientWidth / width, el.clientHeight / height));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div
      ref={ref}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-white"
    >
      <div
        className="shrink-0 origin-center"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
