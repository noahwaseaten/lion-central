"use client";

import { Images } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { MediaLibraryPanel } from "./panel";

export function MediaLibraryTrigger({
  mode,
  selected,
  onPick,
}: {
  mode: "single" | "multi";
  selected: string[];
  onPick: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Several content types render a trigger at once. Mounting the panel only
  // after the first open keeps the closed ones out of the render path entirely.
  const [mounted, setMounted] = useState(false);
  const count = selected.filter(Boolean).length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <Images />
        Browse library{count > 0 ? ` (${count} selected)` : ""}
      </Button>
      {mounted && (
        <MediaLibraryPanel
          open={open}
          onOpenChange={setOpen}
          mode={mode}
          selected={selected}
          onPick={onPick}
        />
      )}
    </>
  );
}

export { MediaLibraryPanel };
