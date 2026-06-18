"use client";

import { Images } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { MediaLibraryModal } from "./modal";

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
  const count = selected.filter(Boolean).length;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Images />
        Browse library{count > 0 ? ` (${count} selected)` : ""}
      </Button>
      <MediaLibraryModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        selected={selected}
        onPick={onPick}
      />
    </>
  );
}

export { MediaLibraryModal };
