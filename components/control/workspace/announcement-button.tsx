"use client";

import { Megaphone } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AnnouncementRecord } from "@/lib/arc/render/inputs";
import { cn } from "@/lib/utils";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const labelCls = "text-xs font-medium text-muted-foreground";

const DURATIONS = [
  { label: "15s", ms: 15_000 },
  { label: "30s", ms: 30_000 },
  { label: "1 min", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
];

export function AnnouncementButton({
  announcement,
  send,
  cancel,
}: {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number) => void;
  cancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [durationMs, setDurationMs] = useState(30_000);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer when an announcement is active
  useEffect(() => {
    if (!announcement) { setRemaining(null); return; }
    const tick = () => setRemaining(Math.max(0, announcement.endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [announcement]);

  // Auto-focus the text input when the popover opens in idle state
  useEffect(() => {
    if (open && !announcement) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, announcement]);

  function handleSend() {
    if (!text.trim()) return;
    send(text.trim(), subtitle.trim() || undefined, durationMs);
    setText("");
    setSubtitle("");
    setDurationMs(30_000);
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
          />
        ) : (
          <IdleState
            text={text}
            subtitle={subtitle}
            durationMs={durationMs}
            inputRef={inputRef}
            onText={setText}
            onSubtitle={setSubtitle}
            onDuration={setDurationMs}
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
  durationMs,
  inputRef,
  onText,
  onSubtitle,
  onDuration,
  onSend,
}: {
  text: string;
  subtitle: string;
  durationMs: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onText: (v: string) => void;
  onSubtitle: (v: string) => void;
  onDuration: (ms: number) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">Send announcement</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Overrides all surfaces for the selected duration.</p>
      </div>

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
        <div className="flex gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.ms}
              type="button"
              onClick={() => onDuration(d.ms)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                durationMs === d.ms
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

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
}: {
  announcement: AnnouncementRecord;
  remaining: number | null;
  onCancel: () => void;
}) {
  const remainingStr =
    remaining === null
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

      <Button variant="destructive" size="sm" onClick={onCancel} className="w-full">
        Cancel announcement
      </Button>
    </div>
  );
}
