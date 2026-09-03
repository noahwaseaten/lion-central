"use client";

import { ArrowsOut, MagnifyingGlass, SidebarSimple } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";

import { Dialog, DialogClose, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { useLogoLibrary } from "@/hooks/use-logo-library";
import { filterAssets, folderCounts } from "@/lib/arc/library-view";

import { AssetGrid } from "./asset-grid";
import { FolderChips } from "./folder-chips";
import { FolderSidebar } from "./folder-sidebar";
import { UploadZone } from "./upload-zone";
import { PANEL_MOTION_MS, usePanelMode, type PanelMode, type PanelPhase } from "./use-panel-mode";

const DOCK_WIDTH = 380;
const TOOLBAR_HEIGHT = 48;
const DOCK_MARGIN = 16;

/** Geometry per mode. Applied instantly — never transitioned. See `usePanelMode`. */
function geometry(mode: PanelMode): React.CSSProperties {
  if (mode === "docked") {
    return {
      left: `calc(100vw - ${DOCK_WIDTH + DOCK_MARGIN}px)`,
      top: `${TOOLBAR_HEIGHT + DOCK_MARGIN}px`,
      width: `${DOCK_WIDTH}px`,
      height: `calc(100dvh - ${TOOLBAR_HEIGHT + DOCK_MARGIN * 2}px)`,
      transform: "none",
    };
  }
  return {
    left: "50%",
    top: "50%",
    width: "min(900px, 90vw)",
    height: "80vh",
    transform: "translate(-50%, -50%)",
  };
}

/** How far the card sits off its resting spot while leaving or arriving. */
const OFFSET = "translate3d(28px, 0, 0) scale(0.98)";

/**
 * Card motion, as compositor-only transform + opacity.
 *
 * Both directions move the same way — out to the right, back in from the right
 * — so the panel always reads as being put away at the side and fetched back
 * from it, rather than teleporting somewhere new each time.
 */
function motionStyle(phase: PanelPhase): React.CSSProperties {
  switch (phase) {
    case "out":
      return {
        transform: OFFSET,
        opacity: 0,
        transition: `transform ${PANEL_MOTION_MS.out}ms ease-in, opacity ${PANEL_MOTION_MS.out}ms ease-in`,
        willChange: "transform, opacity",
      };
    case "in":
      // The arrival start point: snapped into place with no transition, so the
      // step back to rest below is the only thing that animates.
      return {
        transform: OFFSET,
        opacity: 0,
        transition: "none",
        willChange: "transform, opacity",
      };
    default:
      return {
        transform: "none",
        opacity: 1,
        transition: `transform ${PANEL_MOTION_MS.in}ms cubic-bezier(0.16,1,0.3,1), opacity ${PANEL_MOTION_MS.in}ms ease-out`,
      };
  }
}

export function MediaLibraryPanel({
  open,
  onOpenChange,
  selected,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kept for caller compatibility; docking applies to both single and multi picks. */
  mode?: "single" | "multi";
  selected: string[];
  onPick: (url: string) => void;
}) {
  const {
    assets,
    loading,
    error,
    folders,
    assetFolders,
    upload,
    remove,
    createFolder,
    renameFolder,
    deleteFolder,
    moveAsset,
  } = useLogoLibrary();

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // The asset placed most recently. `seq` lets a repeat pick re-announce itself.
  const [pick, setPick] = useState<{ url: string | null; seq: number }>({ url: null, seq: 0 });
  const { mode, phase, setModeByUser, dockAfterPick, reset } = usePanelMode();
  const docked = mode === "docked";

  // Closing puts the panel back to the full centred library for next time.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        reset();
        setPick({ url: null, seq: 0 });
      }
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const filteredAssets = useMemo(
    () => filterAssets(assets, assetFolders, folders, activeFolder, search),
    [assets, assetFolders, folders, activeFolder, search],
  );
  const counts = useMemo(
    () => folderCounts(assets, assetFolders, folders),
    [assets, assetFolders, folders],
  );

  const selectedSet = useMemo(() => new Set(selected.filter(Boolean)), [selected]);

  // Stable identities: the grid and every tile below it are memoised, and a new
  // callback each render would defeat that for the whole library at once.
  const handlePick = useCallback(
    (url: string) => {
      onPick(url);
      setPick((prev) => ({ url, seq: prev.seq + 1 }));
      dockAfterPick();
    },
    [onPick, dockAfterPick],
  );
  const handleDelete = useCallback((id: string) => void remove(id), [remove]);
  const handleMove = useCallback(
    (id: string, folder: string | null) => void moveAsset(id, folder),
    [moveAsset],
  );
  const handleUpload = useCallback(
    async (files: FileList | File[], folder: string | null) => {
      await upload(files, folder ?? undefined);
    },
    [upload],
  );

  // Per-tile folder actions are only offered where a folder list is on screen.
  const tileFolders = useMemo(() => (docked ? [] : folders), [docked, folders]);

  const grid = loading ? (
    <p className="text-xs text-muted-foreground">Loading…</p>
  ) : (
    <AssetGrid
      assets={filteredAssets}
      selected={selectedSet}
      picked={pick.url}
      pickSettled={phase === "settled"}
      pickSeq={pick.seq}
      folders={tileFolders}
      onPick={handlePick}
      onDelete={handleDelete}
      onMove={handleMove}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      modal={!docked}
      // Docked, the whole point is to work the arc with the panel open — an
      // outside click must never take it away.
      disablePointerDismissal={docked}
    >
      <DialogPopup
        backdropHidden={docked}
        positionStyle={geometry(mode)}
        cardClassName={docked ? "shadow-black/40" : undefined}
      >
        <div style={motionStyle(phase)} className="flex h-full min-h-0 w-full flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
            <DialogTitle className="shrink-0">{docked ? "Library" : "Media library"}</DialogTitle>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5">
              <MagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => setModeByUser(docked ? "library" : "docked")}
              aria-label={docked ? "Expand to full library" : "Dock to the side"}
              title={docked ? "Expand to full library" : "Dock to the side"}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
            >
              {docked ? <ArrowsOut /> : <SidebarSimple mirrored />}
            </button>
            <DialogClose />
          </div>

          {docked ? (
            <>
              <FolderChips
                folders={folders}
                counts={counts}
                active={activeFolder}
                onSelect={setActiveFolder}
              />
              <main className="min-h-0 flex-1 overflow-y-auto p-3">
                {error && <p className="pb-2 text-xs text-destructive">{error}</p>}
                {grid}
              </main>
            </>
          ) : (
            <div className="flex min-h-0 flex-1">
              <aside className="w-40 shrink-0 border-r border-border">
                <FolderSidebar
                  folders={folders}
                  counts={counts}
                  active={activeFolder}
                  onSelect={setActiveFolder}
                  onCreate={(name) => void createFolder(name)}
                  onRename={(old, next) => void renameFolder(old, next)}
                  onDelete={(name) => void deleteFolder(name)}
                  onMove={handleMove}
                />
              </aside>

              <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                {error && <p className="text-xs text-destructive">{error}</p>}
                {grid}
                <UploadZone
                  folder={activeFolder === "" ? null : activeFolder}
                  onUpload={handleUpload}
                />
              </main>
            </div>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
