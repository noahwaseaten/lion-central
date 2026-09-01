"use client";

import { ArrowsOut, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Dialog, DialogClose, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { useLogoLibrary } from "@/hooks/use-logo-library";
import { cn } from "@/lib/utils";

import { AssetGrid } from "./asset-grid";
import { FolderSidebar } from "./folder-sidebar";
import { UploadZone } from "./upload-zone";

const PREVIEW_WIDTH = 380;
const TOOLBAR_HEIGHT = 48;
const PREVIEW_MARGIN = 16;

// Shared easing so the panel resize and the sidebar collapse move as one piece.
const DOCK_MOTION = "transition-all duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]";

export function MediaLibraryModal({
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
  // Docked = the slim quick-picker that sits aside so the arc stays visible.
  const [docked, setDocked] = useState(false);

  // Closing always returns to the full centered library for next time.
  const handleOpenChange = (next: boolean) => {
    if (!next) setDocked(false);
    onOpenChange(next);
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeFolder === "") {
      list = list.filter((a) => !assetFolders[a.id]);
    } else if (activeFolder !== null) {
      list = list.filter((a) => assetFolders[a.id] === activeFolder);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [assets, activeFolder, assetFolders, search]);

  const handlePick = (url: string) => {
    onPick(url);
    // Dock aside so the operator can watch the arc update; stays put until they
    // expand back to the full library or close it. No timed snap-back.
    setDocked(true);
  };

  // Both states use the same inline properties (left/top/width/height/transform)
  // so the popup can transition smoothly between them.
  const positionStyle: React.CSSProperties = docked
    ? {
        left: `calc(100vw - ${PREVIEW_WIDTH + PREVIEW_MARGIN}px)`,
        top: `${TOOLBAR_HEIGHT + PREVIEW_MARGIN}px`,
        width: `${PREVIEW_WIDTH}px`,
        height: `calc(100dvh - ${TOOLBAR_HEIGHT + PREVIEW_MARGIN * 2}px)`,
        transform: "none",
      }
    : {
        left: "50%",
        top: "50%",
        width: "min(900px, 90vw)",
        height: "80vh",
        transform: "translate(-50%, -50%)",
      };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup
        className="flex flex-col overflow-hidden"
        backdropHidden={docked}
        positionStyle={positionStyle}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          <DialogTitle className="shrink-0">Media library</DialogTitle>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5">
            <MagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {docked && (
            <button
              type="button"
              onClick={() => setDocked(false)}
              aria-label="Expand to full library"
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
            >
              <ArrowsOut />
            </button>
          )}
          <DialogClose />
        </div>

        <div className="flex min-h-0 flex-1">
          <aside
            className={cn(
              "shrink-0 overflow-hidden border-border",
              DOCK_MOTION,
              docked ? "w-0 border-r-0 opacity-0" : "w-40 border-r opacity-100",
            )}
          >
            <div className="w-40 h-full">
              <FolderSidebar
                folders={folders}
                active={activeFolder}
                onSelect={setActiveFolder}
                onCreate={(name) => void createFolder(name)}
                onRename={(old, next) => void renameFolder(old, next)}
                onDelete={(name) => void deleteFolder(name)}
                onMove={(id, folder) => void moveAsset(id, folder)}
              />
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <AssetGrid
                assets={filteredAssets}
                selected={selected}
                folders={docked ? [] : folders}
                onPick={handlePick}
                onDelete={(id) => void remove(id)}
                onMove={(id, folder) => void moveAsset(id, folder)}
              />
            )}
            <UploadZone
              folder={activeFolder === "" ? null : activeFolder}
              onUpload={async (files, folder) => { await upload(files, folder ?? undefined); }}
            />
          </main>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
