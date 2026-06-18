"use client";

import { FolderSimple, FolderSimplePlus, PencilSimple, Trash } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function FolderSidebar({
  folders,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: string[];
  active: string | null;
  onSelect: (folder: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (old: string, next: string) => void;
  onDelete: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  const commitCreate = () => {
    const name = newName.trim();
    if (name) onCreate(name);
    setNewName("");
    setCreating(false);
  };

  const startRename = (folder: string) => {
    setRenamingFolder(folder);
    setRenameValue(folder);
    setTimeout(() => renameRef.current?.select(), 0);
  };

  const commitRename = () => {
    const next = renameValue.trim();
    if (next && next !== renamingFolder && renamingFolder) {
      onRename(renamingFolder, next);
      if (active === renamingFolder) onSelect(next);
    }
    setRenamingFolder(null);
  };

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-2" aria-label="Folders">
      <SidebarItem label="All" active={active === null} onClick={() => onSelect(null)} />
      <SidebarItem label="Unfiled" active={active === ""} onClick={() => onSelect("")} />

      {folders.length > 0 && <hr className="my-1.5 border-border" />}

      {folders.map((folder) => (
        <div key={folder} className="group relative flex items-center">
          {renamingFolder === folder ? (
            <input
              ref={renameRef}
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingFolder(null);
              }}
              className="h-7 w-full rounded-md border border-ring bg-background px-2 text-xs outline-none"
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSelect(folder)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none transition-colors",
                  active === folder
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <FolderSimple className="size-3.5 shrink-0" />
                <span className="flex-1 truncate">{folder}</span>
              </button>
              <div className="absolute right-1 hidden items-center gap-0.5 group-hover:flex">
                <button
                  type="button"
                  aria-label={`Rename ${folder}`}
                  onClick={(e) => { e.stopPropagation(); startRename(folder); }}
                  className="grid size-5 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
                >
                  <PencilSimple />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${folder}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
                  className="grid size-5 place-items-center rounded text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
                >
                  <Trash />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      <hr className="my-1.5 border-border" />

      {creating ? (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitCreate();
            if (e.key === "Escape") { setCreating(false); setNewName(""); }
          }}
          placeholder="Folder name…"
          className="h-7 w-full rounded-md border border-ring bg-background px-2 text-xs outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground"
        >
          <FolderSimplePlus className="size-3.5 shrink-0" />
          New folder
        </button>
      )}
    </nav>
  );
}

function SidebarItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center rounded-md px-2 text-left text-xs outline-none transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
