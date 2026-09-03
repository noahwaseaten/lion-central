"use client";

import { Check, FolderSimple, Play, Trash } from "@phosphor-icons/react";
import { memo, useEffect, useRef, useState } from "react";

import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useAssetThumbnail, useInView } from "@/hooks/use-asset-thumbnail";
import { isVideoAsset } from "@/lib/arc/assets-shared";
import type { AssetInfo } from "@/lib/arc/assets-shared";
import { cn } from "@/lib/utils";

/**
 * How this tile relates to the most recent pick:
 * - `none`   — not the picked asset.
 * - `queued` — it is, but the panel is still moving; wait before scrolling.
 * - `now`    — it is, and the panel has settled: bring it into view.
 *
 * One prop rather than two so a pick only re-renders the tiles that changed,
 * not the whole grid.
 */
export type TileFocus = "none" | "queued" | "now";

/**
 * Announce the asset that was just placed on the arc: a pop, and a wash of the
 * signal colour that fades off it.
 *
 * Deliberately transient. A marker that stays put reads as a second selection —
 * and picking a sponsor logo *deselects* it, so a lingering ring would say the
 * opposite of the truth. Both effects also stay inside the tile's own box: an
 * outward ring reads as clipped here, since the grid gap is narrower than the
 * ring and the scrolling panel cuts it off at the edges.
 */
function flashPick(tile: Element, wash: Element): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) {
    tile.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.07)" }, { transform: "scale(1)" }],
      { duration: 480, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" },
    );
  }
  // A fade is not motion, so it still runs when motion is reduced — otherwise
  // there would be no answer at all to "which one did I just click?".
  wash.animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], {
    duration: 950,
    easing: "ease-out",
  });
}

/**
 * One asset in the grid.
 *
 * The preview is always a small cached bitmap, never the source file: the
 * library holds multi-megabyte vector logos, and an `<img>` pointed at one is
 * re-rasterised by the browser on every layout change. Memoised, and gated on
 * visibility, so a large library costs about as much as a small one.
 */
export const AssetTile = memo(function AssetTile({
  asset,
  selected,
  focus,
  pickSeq,
  folders,
  onPick,
  onDelete,
  onMove,
}: {
  asset: AssetInfo;
  selected: boolean;
  focus: TileFocus;
  /** Bumped on every pick, so picking the same asset twice flashes it twice. */
  pickSeq: number;
  folders: string[];
  onPick: (url: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folder: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tileRef = useRef<HTMLButtonElement>(null);
  const washRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const isVideo = isVideoAsset(asset.id);
  const thumb = useAssetThumbnail(asset.url, isVideo, inView);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Once the panel has finished moving, bring the asset that was just placed
  // back into view and mark it — after a dock the grid is a third as wide, so
  // the logo the operator clicked is rarely still where they left it.
  useEffect(() => {
    if (focus !== "now") return;
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (tileRef.current && washRef.current) flashPick(tileRef.current, washRef.current);
  }, [focus, pickSeq]);

  return (
    <div
      ref={ref}
      className={cn("group relative flex flex-col gap-1", dragging && "opacity-50")}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("assetId", asset.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      <button
        ref={tileRef}
        type="button"
        onClick={() => onPick(asset.url)}
        title={asset.name}
        className={cn(
          "relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg border bg-[#1c1f26] p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-signal ring-1 ring-signal"
            : "border-input hover:border-foreground/40",
        )}
      >
        <span className="relative grid h-full w-full place-items-center">
          {thumb?.status === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element -- cached raster thumbnail, not a build asset
            <img
              src={thumb.src}
              alt={asset.name}
              width={thumb.w}
              height={thumb.h}
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          ) : thumb?.status === "error" ? (
            <span className="text-[10px] text-muted-foreground">No preview</span>
          ) : (
            <span className="size-8 animate-pulse rounded bg-muted" />
          )}
          {isVideo && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <Play weight="fill" className="size-4 text-white opacity-90 drop-shadow" />
            </span>
          )}
        </span>
        <span
          ref={washRef}
          aria-hidden
          // Inset ring, so the marker can never be clipped by the panel's overflow.
          className="pointer-events-none absolute inset-0 bg-signal/50 opacity-0 ring-2 ring-inset ring-signal"
        />
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
});
