"use client";

import type { ArcConfig } from "@/lib/arc/layout-model";
import { SURFACES } from "@/lib/arc/surfaces";
import type { ConnectionStatus } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

const FEED_COPY: Record<ConnectionStatus, string> = {
  connecting: "feed connecting",
  live: "feed live (push)",
  reconnecting: "feed reconnecting",
  polling: "feed live (polling)",
  empty: "feed connected",
  error: "feed unavailable",
  offline: "feed offline",
};

/** Slim footer: connection truth + a couple of at-a-glance config facts. */
export function StatusBar({
  online,
  feedStatus,
  config,
}: {
  online: boolean;
  feedStatus: ConnectionStatus;
  config: ArcConfig;
}) {
  const all = SURFACES.flatMap((s) => config.surfaces[s.id] ?? []);
  const total = all.length;
  const offCount = all.filter((c) => c.content.type === "off").length;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className={cn("size-1.5 rounded-full", online ? "bg-online" : "bg-muted-foreground")}
          aria-hidden
        />
        {online ? "Online" : "Offline"}
      </span>
      <Dot />
      <span>{FEED_COPY[feedStatus]}</span>
      <Dot />
      <span>
        {total} component{total === 1 ? "" : "s"}
        {offCount > 0 ? ` · ${offCount} off` : ""}
      </span>
      <span className="ml-auto">Autosaved · synced across tabs</span>
    </footer>
  );
}

function Dot() {
  return <span aria-hidden className="size-0.5 rounded-full bg-muted-foreground/60" />;
}
