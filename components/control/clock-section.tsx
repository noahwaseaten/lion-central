"use client";

import { ArrowCounterClockwise, HourglassMedium, Pause, Play } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

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
  "h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

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
  const isCountdown = mode === "countdown";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the input in sync with elapsed while not focused
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
      <div className="flex items-center gap-2">
        {isCountdown && <HourglassMedium weight="fill" className="size-4 text-amber-500" />}
        <div className="text-3xl font-bold tabular-nums">{formatSeconds(elapsed / 1000)}</div>
      </div>
      {isCountdown && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Counting down to start — the clock will switch to counting up automatically at 0:00.
        </p>
      )}
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
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSet();
          }}
          aria-invalid={invalid}
          placeholder="H:MM:SS"
          className={inputCls}
        />
        <Button type="button" variant="secondary" onClick={commitSet}>
          Set
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <label className="text-xs font-medium text-muted-foreground">Countdown to start</label>
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
            placeholder="H:MM:SS"
            className={inputCls}
          />
          <Button type="button" variant="secondary" onClick={commitStartCountdown}>
            <HourglassMedium weight="bold" />
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}
