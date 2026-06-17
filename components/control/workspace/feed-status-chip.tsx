"use client";

import { Broadcast, WifiSlash } from "@phosphor-icons/react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ConnectionStatus } from "@/lib/feed/types";

const MAP: Record<
  ConnectionStatus,
  { label: string; variant: BadgeProps["variant"]; pulse?: boolean }
> = {
  connecting: { label: "Connecting", variant: "muted" },
  live: { label: "Live · push", variant: "live", pulse: true },
  reconnecting: { label: "Reconnecting", variant: "muted" },
  polling: { label: "Live · polling", variant: "signal", pulse: true },
  empty: { label: "No athletes", variant: "online" },
  error: { label: "No feed", variant: "muted" },
  offline: { label: "Offline", variant: "muted" },
};

/** Compact live-feed transport indicator for the toolbar. */
export function FeedStatusChip({ status }: { status: ConnectionStatus }) {
  const s = MAP[status];
  const offline = status === "offline" || status === "error";
  return (
    <Badge variant={s.variant} className="gap-1.5 py-1">
      {offline ? (
        <WifiSlash weight="bold" className="size-3" />
      ) : (
        <Broadcast
          weight="bold"
          className={s.pulse ? "size-3 animate-pulse" : "size-3"}
        />
      )}
      {s.label}
    </Badge>
  );
}
