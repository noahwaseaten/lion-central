"use client";

import { Megaphone } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { AnnouncementRecord } from "@/lib/arc/render/inputs";
import { formatSeconds } from "@/lib/feed/format";
import { parseTime } from "@/lib/feed/parse";
import { cn } from "@/lib/utils";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40";
const labelCls = "text-xs font-medium text-muted-foreground";

const PRESETS = [
  { label: "15s", ms: 15_000 },
  { label: "30s", ms: 30_000 },
  { label: "1 min", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
  { label: "5 min", ms: 300_000 },
];

const EXTEND_PRESETS = [
  { label: "+30s", ms: 30_000 },
  { label: "+1 min", ms: 60_000 },
  { label: "+5 min", ms: 300_000 },
];

export function AnnouncementButton({
  announcement,
  send,
  extend,
  cancel,
}: {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number | null, urgent: boolean) => void;
  extend: (durationMs: number | null) => void;
  cancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [durationDraft, setDurationDraft] = useState("0:30");
  const [durationInvalid, setDurationInvalid] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [urgent, setUrgent] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer when a (non-permanent) announcement is active.
  useEffect(() => {
    if (!announcement || announcement.permanent) { setRemaining(null); return; }
    const tick = () => setRemaining(Math.max(0, announcement.endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [announcement]);

  // Auto-focus the text input when the popover opens in idle state.
  useEffect(() => {
    if (open && !announcement) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, announcement]);

  function handleSend() {
    if (!text.trim()) return;
    let ms: number | null = null;
    if (!permanent) {
      const parsed = parseTime(durationDraft);
      if (parsed === null || parsed <= 0) {
        setDurationInvalid(true);
        return;
      }
      ms = parsed * 1000;
    }
    send(text.trim(), subtitle.trim() || undefined, ms, urgent);
    setText("");
    setSubtitle("");
    setDurationDraft("0:30");
    setDurationInvalid(false);
    setPermanent(false);
    setUrgent(true);
    setOpen(false);
  }

  const isActive = !!announcement;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Send announcement"
            className={cn("relative", isActive && "text-destructive")}
          >
            <Megaphone weight={isActive ? "fill" : "bold"} />
            {isActive && (
              <span className="absolute right-0.5 top-0.5 size-2 animate-pulse rounded-full bg-destructive" />
            )}
          </Button>
        }
      />

      <PopoverContent className="w-72" align="end">
        {isActive ? (
          <ActiveState
            announcement={announcement}
            remaining={remaining}
            onCancel={() => { cancel(); setOpen(false); }}
            onExtend={extend}
          />
        ) : (
          <IdleState
            text={text}
            subtitle={subtitle}
            durationDraft={durationDraft}
            durationInvalid={durationInvalid}
            permanent={permanent}
            urgent={urgent}
            inputRef={inputRef}
            onText={setText}
            onSubtitle={setSubtitle}
            onDurationDraft={(v) => { setDurationDraft(v); setDurationInvalid(false); }}
            onPreset={(ms) => { setDurationDraft(formatSeconds(ms / 1000)); setDurationInvalid(false); setPermanent(false); }}
            onPermanent={setPermanent}
            onUrgent={setUrgent}
            onSend={handleSend}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function IdleState({
  text,
  subtitle,
  durationDraft,
  durationInvalid,
  permanent,
  urgent,
  inputRef,
  onText,
  onSubtitle,
  onDurationDraft,
  onPreset,
  onPermanent,
  onUrgent,
  onSend,
}: {
  text: string;
  subtitle: string;
  durationDraft: string;
  durationInvalid: boolean;
  permanent: boolean;
  urgent: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onText: (v: string) => void;
  onSubtitle: (v: string) => void;
  onDurationDraft: (v: string) => void;
  onPreset: (ms: number) => void;
  onPermanent: (v: boolean) => void;
  onUrgent: (v: boolean) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Send announcement</h3>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Message</label>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Course ahead is clear"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Subtitle (optional)</label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => onSubtitle(e.target.value)}
          placeholder="Next aid station in 2 km"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Duration</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((d) => (
            <button
              key={d.ms}
              type="button"
              onClick={() => onPreset(d.ms)}
              disabled={permanent}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
                "border-input bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={durationDraft}
            onChange={(e) => onDurationDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            disabled={permanent}
            aria-invalid={durationInvalid}
            placeholder="H:MM:SS"
            className={cn(inputCls, "tabular-nums aria-invalid:border-destructive")}
          />
        </div>
      </div>

      <Switch
        id="announcement-permanent"
        checked={permanent}
        onCheckedChange={onPermanent}
        label="No time limit (until removed)"
      />
      <Switch
        id="announcement-urgent"
        checked={urgent}
        onCheckedChange={onUrgent}
        label="Caution border"
      />

      <Button onClick={onSend} disabled={!text.trim()} size="sm" className="w-full">
        Send
      </Button>
    </div>
  );
}

function ActiveState({
  announcement,
  remaining,
  onCancel,
  onExtend,
}: {
  announcement: AnnouncementRecord;
  remaining: number | null;
  onCancel: () => void;
  onExtend: (durationMs: number | null) => void;
}) {
  const remainingStr = announcement.permanent
    ? "No time limit"
    : remaining === null
      ? ""
      : remaining >= 60_000
        ? `${Math.ceil(remaining / 60_000)}m remaining`
        : `${Math.ceil(remaining / 1_000)}s remaining`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-destructive">Announcement live</h3>
        {remainingStr && (
          <p className="mt-0.5 text-xs text-muted-foreground">{remainingStr}</p>
        )}
      </div>

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <p className="text-sm font-medium">{announcement.text}</p>
        {announcement.subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{announcement.subtitle}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Extend</label>
        <div className="flex flex-wrap gap-1.5">
          {EXTEND_PRESETS.map((d) => (
            <button
              key={d.ms}
              type="button"
              onClick={() => onExtend(d.ms)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {d.label}
            </button>
          ))}
          {!announcement.permanent && (
            <button
              type="button"
              onClick={() => onExtend(null)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              No limit
            </button>
          )}
        </div>
      </div>

      <Button variant="destructive" size="sm" onClick={onCancel} className="w-full">
        Cancel announcement
      </Button>
    </div>
  );
}
