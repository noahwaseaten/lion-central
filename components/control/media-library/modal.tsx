"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogClose, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { useLogoLibrary } from "@/hooks/use-logo-library";
import { cn } from "@/lib/utils";

import { AssetGrid } from "./asset-grid";
import { FolderSidebar } from "./folder-sidebar";
import { UploadZone } from "./upload-zone";

const PREVIEW_WIDTH = 340;
const TOOLBAR_HEIGHT = 48;
const PREVIEW_MARGIN = 16;
const PREVIEW_DURATION_MS = 15_000;

export function MediaLibraryModal({
  open,
  onOpenChange,
  mode,
  selected,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "single" | "multi";
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
  const [previewActive, setPreviewActive] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  // Wrap onOpenChange so closing always exits preview and clears the timer
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPreviewActive(false);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    }
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
    if (mode === "single") {
      // Enter/extend preview mode instead of auto-closing
      setPreviewActive(true);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => {
        setPreviewActive(false);
      }, PREVIEW_DURATION_MS);
    }
  };

  // Compute inline position for preview mode — always use left/top so CSS can
  // transition between the two states using consistent units.
  const previewPositionStyle: React.CSSProperties | undefined = previewActive
    ? {
        right: `${PREVIEW_MARGIN}px`,
        top: `${TOOLBAR_HEIGHT + PREVIEW_MARGIN}px`,
        left: "auto",
        width: `${PREVIEW_WIDTH}px`,
        height: `calc(100dvh - ${TOOLBAR_HEIGHT + PREVIEW_MARGIN * 2}px)`,
        transform: "none",
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup
        className={cn(
          "flex flex-col overflow-hidden",
          !previewActive && "h-[80vh] w-[min(900px,90vw)]",
        )}
        backdropHidden={previewActive}
        positionStyle={previewPositionStyle}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <DialogTitle>Media library</DialogTitle>
          <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5">
            <MagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <DialogClose />
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="w-40 shrink-0 overflow-y-auto border-r border-border">
            <FolderSidebar
              folders={folders}
              active={activeFolder}
              onSelect={setActiveFolder}
              onCreate={(name) => void createFolder(name)}
              onRename={(old, next) => void renameFolder(old, next)}
              onDelete={(name) => void deleteFolder(name)}
              onMove={(id, folder) => void moveAsset(id, folder)}
            />
          </aside>

          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <AssetGrid
                assets={filteredAssets}
                selected={selected}
                folders={folders}
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
