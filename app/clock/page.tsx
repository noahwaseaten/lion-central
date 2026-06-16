"use client";

import { ScaleToFit } from "@/components/arc/scale-to-fit";
import { ClockControls } from "@/components/clock/clock-controls";
import { RaceClock } from "@/components/clock/race-clock";
import { useRaceClock } from "@/hooks/use-race-clock";
import { CLOCK } from "@/lib/arc/layout";

export default function ClockPage() {
  const { elapsed, running, start, pause, reset, setElapsedMs } = useRaceClock();

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <ScaleToFit width={CLOCK.w} height={CLOCK.h}>
        <RaceClock elapsed={elapsed} running={running} />
      </ScaleToFit>
      <ClockControls
        elapsed={elapsed}
        running={running}
        start={start}
        pause={pause}
        reset={reset}
        setElapsedMs={setElapsedMs}
      />
    </main>
  );
}
