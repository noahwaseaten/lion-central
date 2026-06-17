"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { FeedSettings } from "@/hooks/use-feed-settings";
import { formatSeconds } from "@/lib/feed/format";
import { parseTime } from "@/lib/feed/parse";
import type { ConnectionStatus } from "@/lib/feed/types";

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

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Operator controls for the live-feed data source: file, thresholds, polling. */
export function FeedSettingsSection({
  settings,
  update,
  status,
}: {
  settings: FeedSettings;
  update: (patch: Partial<FeedSettings>) => void;
  status: ConnectionStatus;
}) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the file list on mount
    void loadFiles();
  }, [loadFiles]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <span className="text-sm font-medium">{STATUS_COPY[status]}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Feed file</span>
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
          className={inputCls}
          value={settings.file ?? ""}
          onChange={(e) => update({ file: e.target.value || null })}
        >
          <option value="">— Select a file —</option>
          {files.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
        {filesError && <p className="text-sm text-destructive">{filesError}</p>}
        {!filesError && !loadingFiles && files.length === 0 && (
          <p className="text-xs text-muted-foreground">No .txt files found. Check FEED_DIR.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Split thresholds (cumulative)
        </span>
        <ThresholdField
          label="Swim ends"
          seconds={settings.thresholds.swimEndSec}
          onCommit={(v) => update({ thresholds: { ...settings.thresholds, swimEndSec: v } })}
        />
        <ThresholdField
          label="Bike ends"
          seconds={settings.thresholds.bikeEndSec}
          onCommit={(v) => update({ thresholds: { ...settings.thresholds, bikeEndSec: v } })}
        />
        <ThresholdField
          label="Grace buffer"
          seconds={settings.thresholds.graceSec}
          onCommit={(v) => update({ thresholds: { ...settings.thresholds, graceSec: v } })}
        />
        <p className="text-xs text-muted-foreground">Format H:MM:SS or MM:SS. Applied live.</p>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        Polling interval (ms)
        <input
          type="number"
          min={500}
          step={250}
          value={settings.pollingMs}
          onChange={(e) => update({ pollingMs: Math.max(500, Number(e.target.value) || 500) })}
          className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.useFallbackAlways}
          onChange={(e) => update({ useFallbackAlways: e.target.checked })}
          className="size-4 accent-primary"
        />
        Always use polling
      </label>
    </div>
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
