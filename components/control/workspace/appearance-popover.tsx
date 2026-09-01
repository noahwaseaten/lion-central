"use client";

import { Palette } from "@phosphor-icons/react";

import { MediaLibraryTrigger } from "@/components/control/media-library";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { BackgroundConfig } from "@/lib/arc/layout-model";

const PRESETS = ["#ffffff", "#000000", "#0e1116", "#f5a524", "#38bdf8"];

/**
 * Global arc appearance — the shared background behind every zone, on every
 * surface: a flat color, or one looping video treated as a single picture
 * spanning the whole arc (each surface shows its own crop of it).
 */
export function AppearancePopover({
  background,
  onChange,
}: {
  background: BackgroundConfig;
  onChange: (background: BackgroundConfig) => void;
}) {
  const isVideo = background.mode === "video";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Arc appearance">
            <Palette weight="bold" />
          </Button>
        }
      />
      <PopoverContent className="w-64">
        <h3 className="text-sm font-semibold">Arc appearance</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Background behind every zone, on every surface.
        </p>

        <div className="mt-3">
          <Switch
            id="bg-video"
            label="Looping video"
            checked={isVideo}
            onCheckedChange={(on) => onChange({ ...background, mode: on ? "video" : "solid" })}
          />
        </div>

        {isVideo && (
          <div className="mt-3 flex flex-col gap-1.5">
            <MediaLibraryTrigger
              mode="single"
              selected={background.videoSrc ? [background.videoSrc] : []}
              onPick={(url) =>
                onChange({ ...background, videoSrc: background.videoSrc === url ? "" : url })
              }
            />
            <p className="text-xs text-muted-foreground">
              Shown, cropped to each surface, as one continuous picture across the whole arc.
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={background.color}
            onChange={(e) => onChange({ ...background, color: e.target.value })}
            aria-label="Background color"
            className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background"
          />
          <input
            type="text"
            value={background.color}
            onChange={(e) => onChange({ ...background, color: e.target.value })}
            aria-label="Background hex"
            maxLength={7}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        {isVideo && (
          <p className="mt-1 text-xs text-muted-foreground">Shown before the video loads, and if none is set.</p>
        )}
        <div className="mt-3 flex gap-1.5">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...background, color: c })}
              aria-label={`Use ${c}`}
              className="size-6 rounded-md border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
