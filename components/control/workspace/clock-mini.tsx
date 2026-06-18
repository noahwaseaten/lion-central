"use client";

import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { formatSeconds } from "@/lib/feed/format";
import { cn } from "@/lib/utils";

/** Compact race-clock readout + transport, always reachable from the toolbar. */
export function ClockMini({
  elapsed,
  running,
  start,
  pause,
  reset,
}: {
  elapsed: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 py-1 pl-2.5 pr-1">
      <span
        className={cn(
          "size-1.5 rounded-full",
          running ? "animate-pulse bg-live" : "bg-muted-foreground",
        )}
        aria-hidden
      />
      <span className="font-mono text-sm tabular-nums" aria-label="Race clock">
        {formatSeconds(elapsed / 1000)}
      </span>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={running ? "Pause clock" : "Start clock"}
        onClick={running ? pause : start}
      >
        {running ? <Pause weight="fill" /> : <Play weight="fill" />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Reset clock" onClick={reset}>
        <ArrowCounterClockwise weight="bold" />
      </Button>
    </div>
  );
}
