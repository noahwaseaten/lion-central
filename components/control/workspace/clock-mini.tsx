"use client";

import { ArrowCounterClockwise, HourglassMedium, Pause, Play } from "@phosphor-icons/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatSeconds } from "@/lib/feed/format";
import { cn } from "@/lib/utils";

/** Compact race-clock readout + transport, always reachable from the toolbar. */
export function ClockMini({
  elapsed,
  running,
  mode,
  start,
  pause,
  reset,
}: {
  elapsed: number;
  running: boolean;
  mode: "elapsed" | "countdown";
  start: () => void;
  pause: () => void;
  reset: () => void;
}) {
  const isCountdown = mode === "countdown";
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 py-1 pl-2.5 pr-1">
      {isCountdown ? (
        <HourglassMedium
          weight="fill"
          className={cn("size-3", running ? "animate-pulse text-amber-500" : "text-muted-foreground")}
          aria-hidden
        />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            running ? "animate-pulse bg-live" : "bg-muted-foreground",
          )}
          aria-hidden
        />
      )}
      <span className="font-mono text-sm tabular-nums" aria-label={isCountdown ? "Countdown to start" : "Race clock"}>
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
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Reset clock" />}
        >
          <ArrowCounterClockwise weight="bold" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset race clock?</AlertDialogTitle>
            <AlertDialogDescription>
              The timer will return to 0:00. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
