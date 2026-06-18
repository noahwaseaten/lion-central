"use client";

import { Palette } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PRESETS = ["#ffffff", "#000000", "#0e1116", "#f5a524", "#38bdf8"];

/** Global arc appearance — the physical surface background color. */
export function AppearancePopover({
  background,
  onChange,
}: {
  background: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Arc appearance">
            <Palette weight="bold" />
          </Button>
        }
      />
      <PopoverContent className="w-60">
        <h3 className="text-sm font-semibold">Arc appearance</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Surface background behind every zone.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={background}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Background color"
            className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background"
          />
          <input
            type="text"
            value={background}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Background hex"
            maxLength={7}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="mt-3 flex gap-1.5">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
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
