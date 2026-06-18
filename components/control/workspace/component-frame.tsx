"use client";

import { useRef } from "react";

import type { ArcComponent, NormRect } from "@/lib/arc/layout-model";
import { type Guide, type Handle, snapMove, snapResize } from "@/lib/arc/snapping";
import type { SurfacePlacement } from "@/lib/arc/stage-layout";
import { cn } from "@/lib/utils";

import { CONTENT_META } from "./content-meta";

const SNAP_PX = 6;
const MIN = 0.04;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Keep a rect inside its surface with a minimum size. */
function constrain(r: NormRect): NormRect {
  const w = Math.min(1, Math.max(MIN, r.w));
  const h = Math.min(1, Math.max(MIN, r.h));
  return { w, h, x: clamp01(Math.min(Math.max(0, r.x), 1 - w)), y: clamp01(Math.min(Math.max(0, r.y), 1 - h)) };
}

interface DragState {
  mode: "move" | Handle;
  px: number;
  py: number;
  rect: NormRect;
}

const HANDLES: { h: Handle; cls: string; cursor: string }[] = [
  { h: "nw", cls: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { h: "n", cls: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { h: "ne", cls: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { h: "e", cls: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { h: "se", cls: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { h: "s", cls: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
  { h: "sw", cls: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { h: "w", cls: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

/**
 * A selectable, draggable, resizable overlay for one placed component. Pointer
 * deltas (screen px) are converted through the stage scale and the surface size to
 * normalized rect edits, with alignment snapping to surface lines and siblings.
 */
export function ComponentFrame({
  comp,
  placement,
  scale,
  selected,
  siblings,
  onSelect,
  onChange,
  onGuides,
}: {
  comp: ArcComponent;
  placement: SurfacePlacement;
  scale: number;
  selected: boolean;
  siblings: NormRect[];
  onSelect: () => void;
  onChange: (rect: NormRect) => void;
  onGuides: (guides: Guide[]) => void;
}) {
  const drag = useRef<DragState | null>(null);
  const meta = CONTENT_META[comp.content.type];
  const label = comp.name ?? meta.label;

  const left = (placement.x + comp.rect.x * placement.w) * scale;
  const top = (placement.y + comp.rect.y * placement.h) * scale;
  const width = comp.rect.w * placement.w * scale;
  const height = comp.rect.h * placement.h * scale;

  const thX = SNAP_PX / (scale * placement.w);
  const thY = SNAP_PX / (scale * placement.h);

  const begin = (mode: DragState["mode"], e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    drag.current = { mode, px: e.clientX, py: e.clientY, rect: comp.rect };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / (scale * placement.w);
    const dy = (e.clientY - d.py) / (scale * placement.h);

    if (d.mode === "move") {
      const moved = { ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy };
      const snapped = snapMove(moved, siblings, thX, thY);
      onGuides(snapped.guides);
      onChange(constrain(snapped.rect));
      return;
    }

    // resize: adjust the edges this handle controls
    const h = d.mode;
    let { x, y, w, hh } = { x: d.rect.x, y: d.rect.y, w: d.rect.w, hh: d.rect.h };
    if (h.includes("e")) w = d.rect.w + dx;
    if (h.includes("s")) hh = d.rect.h + dy;
    if (h.includes("w")) {
      w = d.rect.w - dx;
      x = d.rect.x + dx;
    }
    if (h.includes("n")) {
      hh = d.rect.h - dy;
      y = d.rect.y + dy;
    }
    const snapped = snapResize({ x, y, w, h: hh }, h, siblings, thX, thY);
    onGuides(snapped.guides);
    onChange(constrain(snapped.rect));
  };

  const onUp = () => {
    drag.current = null;
    onGuides([]);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  return (
    <div
      data-component
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${label} — ${meta.label}`}
      onPointerDown={(e) => begin("move", e)}
      onFocus={onSelect}
      className={cn(
        "group absolute rounded-[2px] outline-none",
        selected ? "z-30 cursor-move" : "z-20 cursor-pointer",
      )}
      style={{ left, top, width, height }}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-[2px] ring-inset transition-[box-shadow] duration-150 motion-reduce:transition-none",
          selected
            ? "ring-2 ring-signal"
            : "ring-1 ring-transparent group-hover:ring-foreground/35 group-focus-visible:ring-2 group-focus-visible:ring-ring",
        )}
      />

      {/* label chip */}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 mb-1.5 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-lg shadow-black/40 transition-opacity duration-150 motion-reduce:transition-none",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        <span className={cn("size-1.5 rounded-full", meta.dot)} />
        {label}
      </span>

      {/* resize handles */}
      {selected &&
        HANDLES.map(({ h, cls, cursor }) => (
          <span
            key={h}
            onPointerDown={(e) => begin(h, e)}
            style={{ cursor }}
            className={cn(
              "absolute size-2.5 rounded-[2px] border border-signal bg-background shadow-sm",
              cls,
            )}
          />
        ))}
    </div>
  );
}
