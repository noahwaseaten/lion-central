"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";

/**
 * The race clock rendered with NumberFlow's animated digits. Hours appear only
 * once the elapsed time crosses an hour; minutes/seconds keep leading zeros. Sized
 * by `fontPx`; dims when the clock is paused, mirroring the canvas clock.
 */
export function NumberFlowClock({
  ms,
  running,
  fontPx,
  direction = 1,
  color = "#0a0a0a",
}: {
  ms: number;
  running: boolean;
  fontPx: number;
  /** Count direction: 1 while counting up, -1 during a pre-race countdown. */
  direction?: 1 | -1;
  color?: string;
}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const showH = h > 0;

  return (
    <NumberFlowGroup>
      <div
        className="flex items-baseline font-extrabold leading-none tabular-nums will-change-transform"
        style={{ fontSize: fontPx, color, opacity: running ? 1 : 0.5 }}
      >
        {showH && (
          <>
            <NumberFlow value={h} trend={direction} />
            <span>:</span>
          </>
        )}
        {/* minimumIntegerDigits always on (not just when hours show) so minutes read
            "00" not "0" at the top of every hour — matches the canvas clock's format. */}
        <NumberFlow value={m} format={{ minimumIntegerDigits: 2 }} trend={direction} />
        <span>:</span>
        {/* Forcing `trend` to the clock's actual count direction (instead of NumberFlow's
            default per-digit auto-detection) keeps every digit spinning the same way
            through a carry (e.g. 2:59 -> 3:00) instead of flipping direction mid-roll. */}
        <NumberFlow value={s} format={{ minimumIntegerDigits: 2 }} trend={direction} />
      </div>
    </NumberFlowGroup>
  );
}
