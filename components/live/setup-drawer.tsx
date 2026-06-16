"use client";

import {
  ArrowClockwise,
  CornersOut,
  Gear,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import type { FeedSettings } from "@/hooks/use-feed-settings";
import { formatSeconds } from "@/lib/feed/format";
import { parseTime } from "@/lib/feed/parse";
import type { ConnectionStatus } from "@/lib/feed/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeedFile {
  name: string;
  mtimeMs: number;
}

const STATUS_COPY: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Live (push)",
  reconnecting: "Reconnecting…",
  polling: "Live (polling)",
  empty: "Connected — no athletes yet",
  error: "No feed",
  offline: "Offline",
};

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

/** Off-broadcast operator panel: file picker, thresholds, polling, status. */
export function SetupDrawer({
  settings,
  update,
  status,
}: {
  settings: FeedSettings;
  update: (patch: Partial<FeedSettings>) => void;
  status: ConnectionStatus;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FeedFile[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    setFilesError(null);
    try {
      const res = await fetch("/api/feed/files", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to list files");
      setFiles(data.files ?? []);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : "Failed to list files");
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName);
      if (e.key === "Escape") setOpen(false);
      if ((e.key === "s" || e.key === "S") && !typing) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh file list when the drawer opens
    if (open) void loadFiles();
  }, [open, loadFiles]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Open setup"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 shadow-md"
      >
        <Gear weight="bold" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close setup"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[380px] max-w-[90vw] flex-col gap-6 overflow-y-auto bg-background p-6 text-foreground shadow-xl">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Live Feed Setup</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X weight="bold" />
              </Button>
            </header>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connection</span>
                <span className="text-sm text-muted-foreground">
                  {STATUS_COPY[status]}
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="feed-file" className="text-sm font-medium">
                  Feed file
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => void loadFiles()}
                  disabled={loadingFiles}
                >
                  <ArrowClockwise weight="bold" />
                  Refresh
                </Button>
              </div>
              <select
                id="feed-file"
                value={settings.file ?? ""}
                onChange={(e) => update({ file: e.target.value || null })}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">— Select a file —</option>
                {files.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
              {filesError && (
                <p className="text-sm text-destructive">{filesError}</p>
              )}
              {!filesError && !loadingFiles && files.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No .txt files found. Check FEED_DIR.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <span className="text-sm font-medium">Split thresholds (cumulative)</span>
              <ThresholdField
                label="Swim ends at"
                seconds={settings.thresholds.swimEndSec}
                onCommit={(v) =>
                  update({ thresholds: { ...settings.thresholds, swimEndSec: v } })
                }
              />
              <ThresholdField
                label="Bike ends at"
                seconds={settings.thresholds.bikeEndSec}
                onCommit={(v) =>
                  update({ thresholds: { ...settings.thresholds, bikeEndSec: v } })
                }
              />
              <ThresholdField
                label="Grace buffer"
                seconds={settings.thresholds.graceSec}
                onCommit={(v) =>
                  update({ thresholds: { ...settings.thresholds, graceSec: v } })
                }
              />
              <p className="text-xs text-muted-foreground">
                Format H:MM:SS or MM:SS. Applied live.
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <span className="text-sm font-medium">Connection options</span>
              <label className="flex items-center justify-between gap-3 text-sm">
                Polling interval (ms)
                <input
                  type="number"
                  min={500}
                  step={250}
                  value={settings.pollingMs}
                  onChange={(e) =>
                    update({ pollingMs: Math.max(500, Number(e.target.value) || 500) })
                  }
                  className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={settings.useFallbackAlways}
                onClick={() =>
                  update({ useFallbackAlways: !settings.useFallbackAlways })
                }
                className="flex items-center justify-between gap-3 text-left text-sm"
              >
                Always use polling
                <span
                  className={cn(
                    "relative h-6 w-10 rounded-full transition-colors",
                    settings.useFallbackAlways ? "bg-primary" : "bg-input",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-background transition-transform",
                      settings.useFallbackAlways ? "translate-x-[1.125rem]" : "translate-x-0.5",
                    )}
                  />
                </span>
              </button>
            </section>

            <section className="mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={toggleFullscreen}
                className="w-full"
              >
                <CornersOut weight="bold" />
                Toggle fullscreen
              </Button>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

/** A H:MM:SS / MM:SS time input that commits parsed seconds. */
function ThresholdField({
  label,
  seconds,
  onCommit,
}: {
  label: string;
  seconds: number;
  onCommit: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatSeconds(seconds));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync input draft when the committed value changes
    setDraft(formatSeconds(seconds));
  }, [seconds]);

  const commit = () => {
    const parsed = parseTime(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(parsed);
  };

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        aria-invalid={invalid}
        className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      />
    </label>
  );
}
