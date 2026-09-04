"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { FeedStatusChip } from "@/components/control/workspace/feed-status-chip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { FeedSettings } from "@/hooks/use-feed-settings";
import { CATEGORY_COLOR } from "@/lib/arc/render/zones";
import { formatSeconds } from "@/lib/feed/format";
import { parseTime } from "@/lib/feed/parse";
import type { ConnectionStatus } from "@/lib/feed/types";

/** Read-only reference for the operator — bib windows are fixed, not tunable. */
const CATEGORY_LEGEND = [
  { label: "Ultra", range: "bib 0\u2013264", color: CATEGORY_COLOR.ultra },
  { label: "Half", range: "bib 400\u2013700", color: CATEGORY_COLOR.half },
  { label: "Relay", range: "bib 800+", color: CATEGORY_COLOR.relay },
];

interface FeedFile {
  name: string;
  mtimeMs: number;
}

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Operator controls for the live-feed data source.
 *
 * Laid out the way the rest of the inspector is — every label above its control,
 * one `Switch` rather than a stray raw checkbox — and grouped by how often an
 * operator touches it: the file and the half-marathon offset change race to
 * race, the transport settings almost never.
 */
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <FeedStatusChip status={status} />
      </div>

      <FieldSet
        label="Feed file"
        action={
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
        }
      >
        <select
          className={inputCls}
          value={settings.file ?? ""}
          onChange={(e) => update({ file: e.target.value || null })}
          aria-label="Feed file"
        >
          <option value="">— Select a file —</option>
          {files.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
        {filesError && <p className="text-xs text-destructive">{filesError}</p>}
        {!filesError && !loadingFiles && files.length === 0 && (
          <p className="text-xs text-muted-foreground">No .txt files found. Check FEED_DIR.</p>
        )}
      </FieldSet>

      <FieldSet label="Half marathon offset">
        <TimeField
          label="Subtract from half times"
          seconds={settings.offsets.halfOffsetSec}
          onCommit={(v) => update({ offsets: { ...settings.offsets, halfOffsetSec: v } })}
        />
      </FieldSet>

      <FieldSet label="Categories">
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {CATEGORY_LEGEND.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-foreground">{c.label}</span>
              <span className="tabular-nums">{c.range}</span>
            </li>
          ))}
        </ul>
      </FieldSet>

      <FieldSet label="Polling">
        <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          Interval (ms)
          <input
            type="number"
            min={500}
            step={250}
            value={settings.pollingMs}
            onChange={(e) => update({ pollingMs: Math.max(500, Number(e.target.value) || 500) })}
            className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <Switch
          label="Always use polling"
          checked={settings.useFallbackAlways}
          onCheckedChange={(useFallbackAlways) => update({ useFallbackAlways })}
        />
      </FieldSet>
    </div>
  );
}

/** A labelled group, matching the inspector's label-above rhythm. */
function FieldSet({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A H:MM:SS / MM:SS time input that commits parsed seconds. */
function TimeField({
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
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        aria-invalid={invalid}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      />
    </label>
  );
}
