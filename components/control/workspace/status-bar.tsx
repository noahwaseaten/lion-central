"use client";

import type { ConnectionStatus } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

const FEED_COPY: Record<ConnectionStatus, string> = {
  connecting: "feed connecting",
  live: "feed live",
  reconnecting: "feed reconnecting",
  polling: "feed polling",
  empty: "no athletes",
  error: "no feed",
  offline: "feed offline",
};

export function StatusBar({
  online,
  feedStatus,
}: {
  online: boolean;
  feedStatus: ConnectionStatus;
}) {
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
    </footer>
  );
}

function Dot() {
  return <span aria-hidden className="size-0.5 rounded-full bg-muted-foreground/60" />;
}
