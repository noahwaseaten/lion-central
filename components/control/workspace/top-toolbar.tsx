"use client";

import { CheckCircle, CloudArrowUp } from "@phosphor-icons/react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import type { FeedSettings } from "@/hooks/use-feed-settings";
import type { ArcConfig } from "@/lib/arc/layout-model";
import type { Preset } from "@/lib/arc/presets";
import type { AnnouncementRecord } from "@/lib/arc/render/inputs";
import type { ConnectionStatus } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

import { AnnouncementButton } from "./announcement-button";
import { AppearancePopover } from "./appearance-popover";
import { ClockMini } from "./clock-mini";
import { FeedStatusChip } from "./feed-status-chip";
import { OutputsMenu } from "./outputs-menu";
import { PresetsMenu } from "./presets-menu";
import { TestFeedButton } from "./test-feed-button";

interface AnnouncementControls {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number) => void;
  cancel: () => void;
}

interface ClockControls {
  elapsed: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

interface PresetControls {
  builtins: Preset[];
  custom: Preset[];
  onApply: (config: ArcConfig) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

export function TopToolbar({
  config,
  setBackground,
  feedSettings,
  feedStatus,
  clock,
  presets,
  onPublish,
  isDirty,
  announcementControls,
}: {
  config: ArcConfig;
  setBackground: (bg: string) => void;
  feedSettings: FeedSettings;
  feedStatus: ConnectionStatus;
  clock: ClockControls;
  presets: PresetControls;
  onPublish: () => void;
  isDirty: boolean;
  announcementControls: AnnouncementControls;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      <Wordmark />
      <span className="mx-1 h-5 w-px bg-border" />
      <OutputsMenu />
      <PresetsMenu
        builtins={presets.builtins}
        custom={presets.custom}
        onApply={presets.onApply}
        onSave={presets.onSave}
        onDelete={presets.onDelete}
      />
      <ClockMini
        elapsed={clock.elapsed}
        running={clock.running}
        start={clock.start}
        pause={clock.pause}
        reset={clock.reset}
      />

      <div className="ml-auto flex items-center gap-2">
        <AnnouncementButton
          announcement={announcementControls.announcement}
          send={announcementControls.send}
          cancel={announcementControls.cancel}
        />
        <span className="mx-0.5 h-5 w-px bg-border" />
        <TestFeedButton file={feedSettings.file} />
        <FeedStatusChip status={feedStatus} />
        <span className="mx-0.5 h-5 w-px bg-border" />
        <AppearancePopover background={config.background} onChange={setBackground} />
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Button
          variant={isDirty ? "default" : "ghost"}
          size="sm"
          onClick={onPublish}
          disabled={!isDirty}
          className={cn(
            "gap-1.5 transition-all",
            isDirty && "shadow-sm",
          )}
          aria-label="Save changes to output"
        >
          {isDirty ? (
            <>
              <CloudArrowUp weight="bold" className="size-3.5" />
              Save
            </>
          ) : (
            <>
              <CheckCircle weight="bold" className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Saved</span>
            </>
          )}
        </Button>
      </div>
    </header>
  );
}

/** The official Lion Heart wordmark (white asset) + the app context label. */
function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 pl-1">
      <Image
        src="/long_logo.png"
        alt="Lion Heart"
        width={1042}
        height={286}
        priority
        className="h-[18px] w-auto opacity-95"
      />
    </div>
  );
}
