"use client";

import Image from "next/image";

import type { FeedSettings } from "@/hooks/use-feed-settings";
import type { ArcConfig } from "@/lib/arc/layout-model";
import type { Preset } from "@/lib/arc/presets";
import type { ConnectionStatus } from "@/lib/feed/types";

import { AppearancePopover } from "./appearance-popover";
import { ClockMini } from "./clock-mini";
import { FeedStatusChip } from "./feed-status-chip";
import { OutputsMenu } from "./outputs-menu";
import { PresetsMenu } from "./presets-menu";
import { TestFeedButton } from "./test-feed-button";

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
}: {
  config: ArcConfig;
  setBackground: (bg: string) => void;
  feedSettings: FeedSettings;
  feedStatus: ConnectionStatus;
  clock: ClockControls;
  presets: PresetControls;
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
        <TestFeedButton file={feedSettings.file} />
        <FeedStatusChip status={feedStatus} />
        <span className="mx-0.5 h-5 w-px bg-border" />
        <AppearancePopover background={config.background} onChange={setBackground} />
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
