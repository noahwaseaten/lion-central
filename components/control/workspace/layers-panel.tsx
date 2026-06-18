"use client";

import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";

import type { ContentType } from "@/lib/arc/content";
import type { ArcConfig, Selection } from "@/lib/arc/layout-model";
import type { ReorderDir } from "@/hooks/use-arc-config";
import { SURFACES, type SurfaceId } from "@/lib/arc/surfaces";
import { cn } from "@/lib/utils";

import { AddComponentMenu } from "./add-component-menu";
import { CONTENT_META } from "./content-meta";

/**
 * Left rail: a layers list per surface. Each surface shows its components in
 * z-order (top layer first), with select, reorder, and delete, plus an "Add"
 * affordance to install a new component onto that surface.
 */
export function LayersPanel({
  config,
  selected,
  onSelect,
  addComponent,
  removeComponent,
  reorderComponent,
}: {
  config: ArcConfig;
  selected: Selection | null;
  onSelect: (sel: Selection) => void;
  addComponent: (surface: SurfaceId, type: ContentType) => void;
  removeComponent: (surface: SurfaceId, id: string) => void;
  reorderComponent: (surface: SurfaceId, id: string, dir: ReorderDir) => void;
}) {
  return (
    <nav aria-label="Layers" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      {SURFACES.map((surface) => {
        const list = config.surfaces[surface.id] ?? [];
        const top = [...list].reverse(); // show topmost layer first
        return (
          <div key={surface.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-1.5">
              <button
                type="button"
                onClick={() => onSelect({ surface: surface.id, id: null })}
                className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {surface.label}
              </button>
              {selected?.surface === surface.id && (
                <AddComponentMenu
                  align="end"
                  onAdd={(type) => addComponent(surface.id, type)}
                  trigger={
                    <button
                      type="button"
                      aria-label={`Add component to ${surface.label}`}
                      className="grid size-5 place-items-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus weight="bold" className="size-3.5" />
                    </button>
                  }
                />
              )}
            </div>

            {top.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground/70">No components.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {top.map((comp, i) => {
                  const meta = CONTENT_META[comp.content.type];
                  const active = selected?.surface === surface.id && selected.id === comp.id;
                  const label = comp.name ?? meta.label;
                  return (
                    <li key={comp.id} className="group/row flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect({ surface: surface.id, id: comp.id })}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 motion-reduce:transition-none",
                          "focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
                        <span className="flex-1 truncate">{label}</span>
                        <meta.Icon size={15} weight={active ? "fill" : "regular"} className="shrink-0" />
                      </button>

                      <div
                        className={cn(
                          "flex shrink-0 items-center transition-opacity",
                          active ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
                        )}
                      >
                        <IconBtn
                          label="Move up"
                          disabled={i === 0}
                          onClick={() => reorderComponent(surface.id, comp.id, "forward")}
                        >
                          <ArrowUp className="size-3.5" />
                        </IconBtn>
                        <IconBtn
                          label="Move down"
                          disabled={i === top.length - 1}
                          onClick={() => reorderComponent(surface.id, comp.id, "backward")}
                        >
                          <ArrowDown className="size-3.5" />
                        </IconBtn>
                        <IconBtn label="Delete" onClick={() => removeComponent(surface.id, comp.id)}>
                          <Trash className="size-3.5" />
                        </IconBtn>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-6 place-items-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
