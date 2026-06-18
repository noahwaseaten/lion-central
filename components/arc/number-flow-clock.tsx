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
  color = "#0a0a0a",
}: {
  ms: number;
  running: boolean;
  fontPx: number;
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
            <NumberFlow value={h} />
            <span>:</span>
          </>
        )}
        <NumberFlow value={m} format={showH ? { minimumIntegerDigits: 2 } : undefined} />
        <span>:</span>
        <NumberFlow value={s} format={{ minimumIntegerDigits: 2 }} />
      </div>
    </NumberFlowGroup>
  );
}
