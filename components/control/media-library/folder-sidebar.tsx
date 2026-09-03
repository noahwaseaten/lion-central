"use client";

import {
  FolderSimple,
  FolderSimplePlus,
  PencilSimple,
  Stack,
  Tray,
  Trash,
} from "@phosphor-icons/react";
import { memo, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { FolderCounts } from "@/lib/arc/library-view";

/**
 * Folder rail for the expanded library.
 *
 * Every row shows how much is in it, so an operator can see where things are
 * without clicking through, and every row is a drop target with the same
 * highlight — dragging a logo onto "Unfiled" pulls it out of a folder the same
 * way dragging it onto a folder puts it in one.
 */
export const FolderSidebar = memo(function FolderSidebar({
  folders,
  counts,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: {
  folders: string[];
  counts: FolderCounts;
  active: string | null;
  onSelect: (folder: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (old: string, next: string) => void;
  onDelete: (name: string) => void;
  onMove: (id: string, folder: string | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  // Which row a dragged asset is currently over. "" is Unfiled, null is none.
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const commitCreate = (name: string) => {
    const trimmed = name.trim();
    setCreating(false);
    if (trimmed && !folders.includes(trimmed)) onCreate(trimmed);
  };

  const commitRename = (from: string, to: string) => {
    const trimmed = to.trim();
    setRenaming(null);
    if (!trimmed || trimmed === from || folders.includes(trimmed)) return;
    onRename(from, trimmed);
    if (active === from) onSelect(trimmed);
  };

  const dropZone = (key: string, folder: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(key);
    },
    // Moving between a row's own children fires dragleave too; only clear when
    // the pointer has genuinely left the row, or the highlight strobes.
    onDragLeave: (e: React.DragEvent) => {
      const next = e.relatedTarget;
      if (next instanceof Node && e.currentTarget.contains(next)) return;
      setDropTarget((cur) => (cur === key ? null : cur));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      const id = e.dataTransfer.getData("assetId");
      if (id) onMove(id, folder);
    },
  });

  return (
    <nav className="flex h-full flex-col overflow-y-auto p-2" aria-label="Folders">
      <SectionLabel>Library</SectionLabel>

      <FolderRow
        icon={<Stack />}
        label="All"
        count={counts.all}
        active={active === null}
        onSelect={() => onSelect(null)}
      />
      <FolderRow
        icon={<Tray />}
        label="Unfiled"
        count={counts.unfiled}
        active={active === ""}
        onSelect={() => onSelect("")}
        dropping={dropTarget === ""}
        dropZone={dropZone("", null)}
      />

      <div className="mt-3 flex items-center justify-between gap-1 pr-1">
        <SectionLabel>Folders</SectionLabel>
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="New folder"
          title="New folder"
          className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5"
        >
          <FolderSimplePlus />
        </button>
      </div>

      {folders.length === 0 && !creating && (
        <p className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">
          No folders yet. Create one, then drag logos onto it.
        </p>
      )}

      {folders.map((folder) =>
        renaming === folder ? (
          <NameInput
            key={folder}
            initial={folder}
            onCommit={(next) => commitRename(folder, next)}
            onCancel={() => setRenaming(null)}
          />
        ) : (
          <FolderRow
            key={folder}
            icon={<FolderSimple />}
            label={folder}
            count={counts.byFolder[folder] ?? 0}
            active={active === folder}
            onSelect={() => onSelect(folder)}
            onRename={() => setRenaming(folder)}
            onDelete={() => onDelete(folder)}
            dropping={dropTarget === folder}
            dropZone={dropZone(folder, folder)}
          />
        ),
      )}

      {creating && (
        <NameInput initial="" onCommit={commitCreate} onCancel={() => setCreating(false)} />
      )}
    </nav>
  );
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </p>
  );
}

function FolderRow({
  icon,
  label,
  count,
  active,
  onSelect,
  onRename,
  onDelete,
  dropping,
  dropZone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  dropping?: boolean;
  dropZone?: React.HTMLAttributes<HTMLDivElement>;
}) {
  // Two-step delete, matching the asset tile — a folder is one click to lose.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasActions = Boolean(onRename || onDelete);

  return (
    <div
      {...dropZone}
      className={cn(
        "group/row relative flex items-center rounded-md",
        dropping && "ring-1 ring-signal",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        title={label}
        className={cn(
          "flex h-7 w-full items-center gap-2 rounded-md pl-2 pr-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          // Room for the action chips, which sit over the row's right edge.
          hasActions && "group-hover/row:pr-12 group-focus-within/row:pr-12",
        )}
      >
        <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <span
          className={cn(
            "shrink-0 text-[10px] tabular-nums text-muted-foreground",
            hasActions && "group-hover/row:hidden group-focus-within/row:hidden",
          )}
        >
          {count || ""}
        </span>
      </button>

      {hasActions && (
        // Opacity rather than `hidden`, so the buttons are reachable by keyboard.
        <div className="pointer-events-none absolute right-1 flex items-center gap-0.5 rounded bg-accent/95 opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100">
          {onRename && (
            <button
              type="button"
              aria-label={`Rename ${label}`}
              onClick={onRename}
              className="grid size-5 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
            >
              <PencilSimple />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label={confirmDelete ? `Confirm delete ${label}` : `Delete ${label}`}
              title={confirmDelete ? "Click again to delete" : undefined}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                setConfirmDelete(false);
                onDelete();
              }}
              onBlur={() => setConfirmDelete(false)}
              className={cn(
                "grid size-5 place-items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3",
                confirmDelete
                  ? "bg-destructive/90 text-white"
                  : "text-muted-foreground hover:text-destructive",
              )}
            >
              <Trash />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline name field for create and rename. Enter commits, Escape and blur both
 * cancel — losing focus should never quietly create or rename something.
 */
function NameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.select(), []);

  return (
    <input
      ref={ref}
      autoFocus
      value={value}
      placeholder="Folder name…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(value);
        if (e.key === "Escape") onCancel();
      }}
      className="h-7 w-full rounded-md border border-ring bg-background px-2 text-xs outline-none"
    />
  );
}
