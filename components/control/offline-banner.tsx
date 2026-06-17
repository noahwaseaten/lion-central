import { WifiSlash } from "@phosphor-icons/react";

/**
 * Internet-offline banner. The feed itself is local, so it keeps running — this
 * only warns that network-fetched assets (image/video URLs) may not load.
 */
export function OfflineBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
      <WifiSlash weight="bold" className="size-4 shrink-0" aria-hidden />
      <span>Offline — the feed is local and still live; remote assets may not load.</span>
    </div>
  );
}
