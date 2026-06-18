"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Dialog, DialogClose, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { useLogoLibrary } from "@/hooks/use-logo-library";

import { AssetGrid } from "./asset-grid";
import { FolderSidebar } from "./folder-sidebar";
import { UploadZone } from "./upload-zone";

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
    if (mode === "single") onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex h-[80vh] w-[min(900px,90vw)] flex-col overflow-hidden">
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
