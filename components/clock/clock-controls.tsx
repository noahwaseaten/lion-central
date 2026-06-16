"use client";

import {
  ArrowCounterClockwise,
  CornersOut,
  Gear,
  Pause,
  Play,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { formatSeconds } from "@/lib/feed/format";
import { parseTime } from "@/lib/feed/parse";
import { Button } from "@/components/ui/button";

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

interface ClockControlsProps {
  elapsed: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setElapsedMs: (ms: number) => void;
}

/** Off-broadcast drawer for the race clock: start/pause/reset/set/fullscreen. */
export function ClockControls({
  elapsed,
  running,
  start,
  pause,
  reset,
  setElapsedMs,
}: ClockControlsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName);
      if (e.key === "Escape") setOpen(false);
      if ((e.key === "c" || e.key === "C") && !typing) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the input from current elapsed when opened
    if (open) setDraft(formatSeconds(elapsed / 1000));
  }, [open, elapsed]);

  const commitSet = () => {
    const parsed = parseTime(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setElapsedMs(parsed * 1000);
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Open clock controls"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 shadow-md"
      >
        <Gear weight="bold" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close controls"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[340px] max-w-[90vw] flex-col gap-6 bg-background p-6 text-foreground shadow-xl">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Race Clock</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X weight="bold" />
              </Button>
            </header>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={running ? "secondary" : "default"}
                onClick={running ? pause : start}
              >
                {running ? <Pause weight="bold" /> : <Play weight="bold" />}
                {running ? "Pause" : "Start"}
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                <ArrowCounterClockwise weight="bold" />
                Reset
              </Button>
            </div>

            <section className="flex flex-col gap-2">
              <label htmlFor="set-elapsed" className="text-sm font-medium">
                Set elapsed time
              </label>
              <div className="flex gap-2">
                <input
                  id="set-elapsed"
                  type="text"
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSet();
                  }}
                  aria-invalid={invalid}
                  placeholder="H:MM:SS"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                />
                <Button type="button" variant="secondary" onClick={commitSet}>
                  Set
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Format H:MM:SS or MM:SS.</p>
            </section>

            <section className="mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={toggleFullscreen}
                className="w-full"
              >
                <CornersOut weight="bold" />
                Toggle fullscreen
              </Button>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
