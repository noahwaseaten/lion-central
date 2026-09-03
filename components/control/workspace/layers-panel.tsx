"use client";

import { useState } from "react";

import { CaretDown, CaretRight, Copy, DotsSixVertical, Plus, Trash } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import type { ContentType } from "@/lib/arc/content";
import type { ArcConfig, Selection } from "@/lib/arc/layout-model";
import { SURFACES, type SurfaceId } from "@/lib/arc/surfaces";
import { cn } from "@/lib/utils";

import { AddComponentMenu } from "./add-component-menu";
import { CONTENT_META } from "./content-meta";
import { IconActionButton } from "./icon-action-button";

interface DragState {
  surface: SurfaceId;
  id: string;
  /** Display-order gap index (0 = above the topmost row, list.length = below the bottommost). */
  overGap: number | null;
}

/**
 * Left rail: a layers list per surface, styled after Figma/Canva's layer trees —
 * icon-only type indicators (no color coding), drag-to-reorder, double-click to
 * rename in place, and collapsible surface groups. Selecting a surface's own
 * header (not a layer) targets the surface itself for surface-level actions.
 */
export function LayersPanel({
  config,
  selected,
  onSelect,
  addComponent,
  duplicateComponent,
  removeComponent,
  renameComponent,
  setSurfaceOrder,
}: {
  config: ArcConfig;
  selected: Selection | null;
  onSelect: (sel: Selection) => void;
  addComponent: (surface: SurfaceId, type: ContentType) => void;
  duplicateComponent: (surface: SurfaceId, id: string) => void;
  removeComponent: (surface: SurfaceId, id: string) => void;
  renameComponent: (surface: SurfaceId, id: string, name: string) => void;
  setSurfaceOrder: (surface: SurfaceId, orderedIds: string[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Partial<Record<SurfaceId, boolean>>>({});
  const [renaming, setRenaming] = useState<{ surface: SurfaceId; id: string; draft: string } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const commitRename = () => {
    if (!renaming) return;
    renameComponent(renaming.surface, renaming.id, renaming.draft);
    setRenaming(null);
  };

  return (
    <nav aria-label="Layers" className="flex h-full flex-col overflow-y-auto p-3">
      {SURFACES.map((surface, si) => {
        const list = config.surfaces[surface.id] ?? [];
        const top = [...list].reverse(); // display order: topmost layer first, like every layer tree
        const isOpen = !collapsed[surface.id];

        return (
          <div key={surface.id} className={cn("flex flex-col gap-1 py-2.5", si > 0 && "border-t border-border")}>
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [surface.id]: !c[surface.id] }))}
                aria-expanded={isOpen}
                className="flex items-center gap-1 rounded py-0.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              >
                {isOpen ? <CaretDown className="size-3" /> : <CaretRight className="size-3" />}
                {surface.label}
                {list.length > 0 && (
                  <span className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground/50">
                    {list.length}
                  </span>
                )}
              </button>
              <AddComponentMenu
                align="end"
                onAdd={(type) => {
                  setCollapsed((c) => ({ ...c, [surface.id]: false }));
                  addComponent(surface.id, type);
                }}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Add component to ${surface.label}`}
                    title="Add component"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Plus weight="bold" className="size-3.5" />
                  </Button>
                }
              />
            </div>

            {isOpen &&
              (top.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onSelect({ surface: surface.id, id: null })}
                  className="rounded-md border border-dashed border-border px-2.5 py-2 text-left text-xs text-muted-foreground/70 outline-none transition-colors duration-150 hover:border-foreground/20 hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
                >
                  Empty — use “Add”
                </button>
              ) : (
                <ul className="flex flex-col">
                  {top.map((comp, i) => {
                    const meta = CONTENT_META[comp.content.type];
                    const active = selected?.surface === surface.id && selected.id === comp.id;
                    const label = comp.name ?? meta.label;
                    const isRenaming = renaming?.surface === surface.id && renaming.id === comp.id;
                    const isDragging = drag?.id === comp.id;
                    const gapBefore = drag?.surface === surface.id && drag.overGap === i;
                    const gapAfter = drag?.surface === surface.id && drag.overGap === top.length && i === top.length - 1;

                    return (
                      <li key={comp.id} className="relative">
                        {gapBefore && <DropIndicator position="top" />}
                        <div
                          draggable={!isRenaming}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDrag({ surface: surface.id, id: comp.id, overGap: null });
                          }}
                          onDragEnd={() => setDrag(null)}
                          onDragOver={(e) => {
                            if (!drag || drag.surface !== surface.id) return;
                            e.preventDefault();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const before = e.clientY < rect.top + rect.height / 2;
                            setDrag((d) => (d ? { ...d, overGap: before ? i : i + 1 } : d));
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!drag || drag.surface !== surface.id || drag.overGap === null) return;
                            const ids = top.map((c) => c.id);
                            const from = ids.indexOf(drag.id);
                            if (from < 0) return;
                            ids.splice(from, 1);
                            const insertAt = drag.overGap > from ? drag.overGap - 1 : drag.overGap;
                            ids.splice(insertAt, 0, drag.id);
                            setSurfaceOrder(surface.id, [...ids].reverse());
                            setDrag(null);
                          }}
                          className={cn(
                            "group/row flex items-center gap-0.5 rounded-lg",
                            isDragging && "opacity-40",
                          )}
                        >
                          <span
                            className="cursor-grab pl-0.5 text-muted-foreground/40 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 active:cursor-grabbing motion-reduce:transition-none"
                            aria-hidden
                          >
                            <DotsSixVertical className="size-3.5" />
                          </span>

                          {isRenaming ? (
                            <input
                              autoFocus
                              value={renaming.draft}
                              placeholder={meta.label}
                              aria-label="Layer name"
                              onChange={(e) => setRenaming((r) => (r ? { ...r, draft: e.target.value } : r))}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitRename();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setRenaming(null);
                                }
                              }}
                              className="my-0.5 min-w-0 flex-1 rounded-md bg-muted px-1.5 py-1 text-sm outline-none ring-3 ring-ring/50"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelect({ surface: surface.id, id: comp.id })}
                              onDoubleClick={() =>
                                setRenaming({ surface: surface.id, id: comp.id, draft: comp.name ?? "" })
                              }
                              aria-current={active ? "true" : undefined}
                              title="Double-click to rename"
                              className={cn(
                                "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm outline-none transition-colors duration-150 motion-reduce:transition-none",
                                "focus-visible:ring-3 focus-visible:ring-ring/50",
                                "active:not-aria-[haspopup]:translate-y-px",
                                active
                                  ? "bg-accent text-accent-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              <meta.Icon size={15} weight={active ? "fill" : "regular"} className="shrink-0" />
                              <span className={cn("flex-1 truncate", !comp.name && !active && "text-muted-foreground/70")}>
                                {label}
                              </span>
                            </button>
                          )}

                          <div
                            className={cn(
                              "flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-within/row:opacity-100 motion-reduce:transition-none",
                              active && "opacity-100",
                            )}
                          >
                            <IconActionButton label="Duplicate" onClick={() => duplicateComponent(surface.id, comp.id)}>
                              <Copy className="size-3.5" />
                            </IconActionButton>
                            <IconActionButton label="Delete" onClick={() => removeComponent(surface.id, comp.id)}>
                              <Trash className="size-3.5" />
                            </IconActionButton>
                          </div>
                        </div>
                        {gapAfter && <DropIndicator position="bottom" />}
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>
        );
      })}
    </nav>
  );
}

/** The insertion line shown while dragging a layer between two rows. */
function DropIndicator({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-signal",
        position === "top" ? "-top-px" : "-bottom-px",
      )}
    />
  );
}
