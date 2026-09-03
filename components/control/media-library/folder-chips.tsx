"use client";

import { memo } from "react";

import type { FolderCounts, FolderFilter } from "@/lib/arc/library-view";
import { cn } from "@/lib/utils";

/**
 * Folder filter for the docked panel, where the rail doesn't fit. Same choices
 * and same counts as `FolderSidebar`, laid out as a single scrolling row.
 */
export const FolderChips = memo(function FolderChips({
  folders,
  counts,
  active,
  onSelect,
}: {
  folders: string[];
  counts: FolderCounts;
  active: FolderFilter;
  onSelect: (folder: FolderFilter) => void;
}) {
  const chip = (label: string, value: FolderFilter, count: number) => (
    <button
      key={label}
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active === value
          ? "border-signal bg-accent font-medium text-foreground"
          : "border-input text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      {count > 0 && <span className="text-[10px] tabular-nums opacity-70">{count}</span>}
    </button>
  );

  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
      {chip("All", null, counts.all)}
      {chip("Unfiled", "", counts.unfiled)}
      {folders.map((f) => chip(f, f, counts.byFolder[f] ?? 0))}
    </div>
  );
});
