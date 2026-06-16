"use client";

import { formatClock } from "@/lib/feed/format";
import { cn } from "@/lib/utils";

/** The race-clock counter surface (renders inside a 320×64 ScaleToFit). */
export function RaceClock({
  elapsed,
  running,
}: {
  elapsed: number;
  running: boolean;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <span
        className={cn(
          "text-[44px] font-bold leading-none tracking-tight tabular-nums text-neutral-950 transition-opacity",
          !running && "opacity-50",
        )}
      >
        {formatClock(elapsed)}
      </span>
    </div>
  );
}
