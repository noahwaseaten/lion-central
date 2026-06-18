"use client";

import { Check, FolderSimple, Play, Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { isVideoAsset } from "@/lib/arc/assets-store";
import type { AssetInfo } from "@/lib/arc/assets-store";
import { cn } from "@/lib/utils";

function VideoThumbnail({ url }: { url: string }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      video.currentTime = 0.1;
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const w = Math.min(video.videoWidth, 160);
      const h = Math.round((w / video.videoWidth) * video.videoHeight);
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
      setThumb(canvas.toDataURL("image/jpeg", 0.8));
      video.src = "";
    };
    return () => {
      video.src = "";
    };
  }, [url]);

  return (
    <div className="relative grid h-full w-full place-items-center">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- canvas-extracted thumbnail, not a build asset
        <img src={thumb} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="size-8 animate-pulse rounded bg-muted" />
      )}
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <Play weight="fill" className="size-4 text-white opacity-90 drop-shadow" />
      </span>
    </div>
  );
}

export function AssetTile({
  asset,
  selected,
  folders,
  onPick,
  onDelete,
  onMove,
}: {
  asset: AssetInfo;
  selected: boolean;
  folders: string[];
  onPick: (url: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folder: string | null) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group relative flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onPick(asset.url)}
        title={asset.name}
        className={cn(
          "grid aspect-square w-full place-items-center overflow-hidden rounded-lg border bg-[#1c1f26] p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-signal ring-1 ring-signal"
            : "border-input hover:border-foreground/40",
        )}
      >
        {isVideoAsset(asset.id) ? (
          <VideoThumbnail url={asset.url} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded logo, not a build asset
          <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
        )}
      </button>

      {selected && (
        <span className="pointer-events-none absolute left-1 top-1 grid size-4 place-items-center rounded-full bg-signal text-background">
          <Check weight="bold" className="size-2.5" />
        </span>
      )}

      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {folders.length > 0 && (
          <Menu>
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Move to folder"
                  className="grid size-5 place-items-center rounded bg-background/90 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
                >
                  <FolderSimple />
                </button>
              }
            />
            <MenuContent side="bottom" align="end">
              <MenuLabel>Move to</MenuLabel>
              <MenuItem onClick={() => onMove(asset.id, null)}>Unfiled</MenuItem>
              <MenuSeparator />
              {folders.map((f) => (
                <MenuItem key={f} onClick={() => onMove(asset.id, f)}>
                  {f}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}

        {confirmDelete ? (
          <button
            type="button"
            aria-label="Confirm delete"
            onClick={() => {
              setConfirmDelete(false);
              onDelete(asset.id);
            }}
            className="grid size-5 place-items-center rounded bg-destructive/90 text-white outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
          >
            <Trash />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${asset.name}`}
            onClick={() => setConfirmDelete(true)}
            onBlur={() => setConfirmDelete(false)}
            className="grid size-5 place-items-center rounded bg-background/90 text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
          >
            <Trash />
          </button>
        )}
      </div>

      <p className="truncate px-0.5 text-center text-[10px] text-muted-foreground" title={asset.name}>
        {asset.name}
      </p>
    </div>
  );
}
