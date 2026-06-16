import { WarningCircle, WifiSlash } from "@phosphor-icons/react";

import { FEED_ROWS } from "@/lib/arc/layout";
import type { ConnectionStatus } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

/** Pulsing placeholder rows shown while first connecting. */
export function FeedSkeleton() {
  return (
    <div className="flex h-full w-full flex-col">
      {Array.from({ length: FEED_ROWS }).map((_, i) => (
        <div
          key={i}
          className="flex h-[70px] items-center gap-4 border-b border-border/60 px-6 last:border-b-0"
        >
          <div className="size-6 shrink-0 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-5 w-14 animate-pulse rounded bg-neutral-200" />
          <div className="h-6 w-48 animate-pulse rounded bg-neutral-200" />
          <div className="ml-auto h-5 w-20 animate-pulse rounded bg-neutral-200" />
        </div>
      ))}
    </div>
  );
}

/** Connected but no athletes yet. */
export function FeedEmpty() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
      <div className="size-3 animate-pulse rounded-full bg-neutral-300" />
      <p className="text-lg font-medium tracking-wide">Waiting for the first athlete…</p>
    </div>
  );
}

/** No file / unreadable feed. Points the operator to setup, no raw errors. */
export function FeedError() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
      <WarningCircle weight="bold" className="size-7" aria-hidden />
      <p className="text-lg font-medium">Feed unavailable</p>
      <p className="text-sm text-neutral-400">Open setup (press S) to choose a feed file.</p>
    </div>
  );
}

const PILL_COPY: Partial<Record<ConnectionStatus, string>> = {
  reconnecting: "Reconnecting…",
  polling: "Polling",
  offline: "Offline — feed is local",
};

/** Small unobtrusive connection indicator overlaid on the bar. */
export function StatusPill({ status }: { status: ConnectionStatus }) {
  const copy = PILL_COPY[status];
  if (!copy) return null;
  return (
    <div
      className={cn(
        "absolute right-3 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        "bg-neutral-900/5 text-neutral-500",
      )}
    >
      {status === "offline" ? (
        <WifiSlash weight="bold" className="size-3.5" aria-hidden />
      ) : (
        <span className="size-2 animate-pulse rounded-full bg-amber-500" />
      )}
      {copy}
    </div>
  );
}
