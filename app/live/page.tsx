"use client";

import { ScaleToFit } from "@/components/arc/scale-to-fit";
import { TopBarStage } from "@/components/arc/top-bar-stage";
import { SetupDrawer } from "@/components/live/setup-drawer";
import { useFeed } from "@/hooks/use-feed";
import { useFeedSettings } from "@/hooks/use-feed-settings";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { TOP_BAR } from "@/lib/arc/layout";

export default function LivePage() {
  const { settings, update, loaded } = useFeedSettings();
  const online = useOnlineStatus();
  const { entries, status } = useFeed({
    file: settings.file,
    thresholds: settings.thresholds,
    pollingMs: settings.pollingMs,
    useFallbackAlways: settings.useFallbackAlways,
    online,
  });

  // Before settings load, show a neutral connecting state rather than a flash of error.
  const displayStatus = !loaded ? "connecting" : status;

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <ScaleToFit width={TOP_BAR.w} height={TOP_BAR.h}>
        <TopBarStage entries={entries} status={displayStatus} />
      </ScaleToFit>
      <SetupDrawer settings={settings} update={update} status={displayStatus} />
    </main>
  );
}
