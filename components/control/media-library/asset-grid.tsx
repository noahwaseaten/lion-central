"use client";

import type { AssetInfo } from "@/lib/arc/assets-shared";

import { AssetTile } from "./asset-tile";

export function AssetGrid({
  assets,
  selected,
  folders,
  onPick,
  onDelete,
  onMove,
}: {
  assets: AssetInfo[];
  selected: string[];
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
          selected={selected.includes(a.url)}
          folders={folders}
          onPick={onPick}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
