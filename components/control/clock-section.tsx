"use client";

import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatSeconds } from "@/lib/feed/format";
import { parseTime } from "@/lib/feed/parse";

interface ClockSectionProps {
  elapsed: number;
  running: boolean;
  mode: "elapsed" | "countdown";
  start: () => void;
  pause: () => void;
  reset: () => void;
  setElapsedMs: (ms: number) => void;
  startCountdown: (ms: number) => void;
}

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

const labelCls = "text-xs font-medium text-muted-foreground";

/** Operator controls for the race clock shown on the arc's top panel. */
export function ClockSection({
  elapsed,
  running,
  mode,
  start,
  pause,
  reset,
  setElapsedMs,
  startCountdown,
}: ClockSectionProps) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [countdownDraft, setCountdownDraft] = useState("10:00");
  const [countdownInvalid, setCountdownInvalid] = useState(false);

  // The clock ticks many times a second. Following it into the input overwrote
  // every keystroke, so a running clock could not be re-set at all — leave the
  // field alone while it has focus.
  const setRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (setRef.current && document.activeElement === setRef.current) return;
    setDraft(formatSeconds(elapsed / 1000));
  }, [elapsed]);

  const commitSet = () => {
    const parsed = parseTime(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setElapsedMs(parsed * 1000);
    setRef.current?.blur();
  };

  const commitStartCountdown = () => {
    const parsed = parseTime(countdownDraft);
    if (parsed === null || parsed <= 0) {
      setCountdownInvalid(true);
      return;
    }
    setCountdownInvalid(false);
    startCountdown(parsed * 1000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-bold tabular-nums">{formatSeconds(elapsed / 1000)}</span>
        <span className="text-xs text-muted-foreground">
          {mode === "countdown" ? "Countdown" : "Elapsed"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
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

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>Set the clock to</span>
        <div className="flex gap-2">
          <input
            ref={setRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSet();
            }}
            aria-invalid={invalid}
            aria-label="Set the clock to"
            placeholder="H:MM:SS"
            className={inputCls}
          />
          <Button type="button" variant="secondary" className="shrink-0" onClick={commitSet}>
            Set
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>Count down from</span>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={countdownDraft}
            onChange={(e) => setCountdownDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitStartCountdown();
            }}
            aria-invalid={countdownInvalid}
            aria-label="Count down from"
            placeholder="H:MM:SS"
            className={inputCls}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={commitStartCountdown}
          >
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}
