"use client";

import { memo } from "react";

import type { AssetInfo } from "@/lib/arc/assets-shared";

import { AssetTile } from "./asset-tile";

export const AssetGrid = memo(function AssetGrid({
  assets,
  selected,
  picked,
  pickSettled,
  pickSeq,
  folders,
  onPick,
  onDelete,
  onMove,
}: {
  assets: AssetInfo[];
  /** Picked URLs. A Set so a large library doesn't cost O(n²) per render. */
  selected: ReadonlySet<string>;
  /** The asset placed most recently, marked and scrolled to once the panel settles. */
  picked: string | null;
  pickSettled: boolean;
  /** Bumped on every pick, so re-picking the same asset marks it again. */
  pickSeq: number;
  folders: string[];
  onPick: (url: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folder: string | null) => void;
}) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No assets here yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
      {assets.map((a) => (
        <AssetTile
          key={a.id}
          asset={a}
          selected={selected.has(a.url)}
          focus={a.url !== picked ? "none" : pickSettled ? "now" : "queued"}
          pickSeq={a.url === picked ? pickSeq : 0}
          folders={folders}
          onPick={onPick}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </div>
  );
});
