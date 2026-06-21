"use client";

import { useMemo } from "react";

import type { SurfaceInputs } from "@/lib/arc/render/inputs";

import { useArcConfig } from "./use-arc-config";
import { useFeed } from "./use-feed";
import { useFeedSettings } from "./use-feed-settings";
import { useOnlineStatus } from "./use-online-status";
import { useRaceClock } from "./use-race-clock";

/**
 * Composes every live input the compositor needs (arc config + feed + clock)
 * into a single `SurfaceInputs`. Read-only — used by the output routes. The
 * control page wires the same hooks itself so it can also expose their setters.
 */
export function useArcInputs(): SurfaceInputs {
  const { config } = useArcConfig();
  const { settings } = useFeedSettings();
  const online = useOnlineStatus();
  const { entries, status } = useFeed({
    file: settings.file,
    thresholds: settings.thresholds,
    pollingMs: settings.pollingMs,
    useFallbackAlways: settings.useFallbackAlways,
    online,
  });
  const { elapsed, running } = useRaceClock();

  return useMemo<SurfaceInputs>(
    () => ({
      config,
      feed: { entries, status, lastArrivalMs: 0, lastArrivalSplit: null },
      clock: { ms: elapsed, running },
      announcement: null,
    }),
    [config, entries, status, elapsed, running],
  );
}
