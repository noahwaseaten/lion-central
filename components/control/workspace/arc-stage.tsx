"use client";

import {
  CornersOut,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Plus,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import type { ContentType } from "@/lib/arc/content";
import {
  type ArcConfig,
  type NormRect,
  type Selection,
} from "@/lib/arc/layout-model";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import type { Guide } from "@/lib/arc/snapping";
import {
  fitScale,
  getPlacement,
  STAGE_BOX,
} from "@/lib/arc/stage-layout";
import { SURFACES, type SurfaceId } from "@/lib/arc/surfaces";
import { cn } from "@/lib/utils";

import { AddComponentMenu } from "./add-component-menu";
import { ArcSurface } from "./arc-surface";
import { ComponentFrame } from "./component-frame";

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_BTN = 1.25;

interface View {
  scale: number;
  tx: number;
  ty: number;
}

function zoomAround(v: View, nextScale: number, cx: number, cy: number): View {
  const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextScale));
  const nx = (cx - v.tx) / v.scale;
  const ny = (cy - v.ty) / v.scale;
  return { scale, tx: cx - nx * scale, ty: cy - ny * scale };
}

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ w: box.width, h: box.height });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

interface ActiveGuides {
  surface: SurfaceId;
  lines: Guide[];
}

export function ArcStage({
  config,
  inputs,
  selected,
  onSelect,
  setComponentRect,
  addComponent,
  removeComponent,
}: {
  config: ArcConfig;
  inputs: SurfaceInputs;
  selected: Selection | null;
  onSelect: (sel: Selection | null) => void;
  setComponentRect: (surface: SurfaceId, id: string, rect: NormRect) => void;
  addComponent: (surface: SurfaceId, type: ContentType) => void;
  removeComponent: (surface: SurfaceId, id: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(viewportRef);
  const [view, setView] = useState<View | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [guides, setGuides] = useState<ActiveGuides | null>(null);

  const fitView = useCallback((W: number, H: number): View => {
    const scale = fitScale(W, H);
    return { scale, tx: (W - STAGE_BOX.w * scale) / 2, ty: (H - STAGE_BOX.h * scale) / 2 };
  }, []);

  useLayoutEffect(() => {
    if (w > 0 && h > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the view from the measured viewport
      setView((v) => v ?? fitView(w, h));
    }
  }, [w, h, fitView]);

  // Wheel = pan; ⌘/Ctrl-wheel (and trackpad pinch) = zoom toward the cursor.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0016);
        setView((v) => (v ? zoomAround(v, v.scale * factor, cx, cy) : v));
      } else {
        setView((v) => (v ? { ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY } : v));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Hold space to pan from anywhere.
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping()) setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Delete / nudge / deselect the selected component.
  useEffect(() => {
    if (!selected || selected.id === null) return;
    const selSurface = selected.surface;
    const selId: string = selected.id;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const list = config.surfaces[selSurface] ?? [];
      const comp = list.find((c) => c.id === selId);
      if (!comp) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeComponent(selSurface, selId);
        onSelect(null);
        return;
      }
      if (e.key === "Escape") return onSelect(null);

      const step = e.shiftKey ? 0.05 : 0.01;
      const r = comp.rect;
      const nudge = (patch: Partial<NormRect>) => {
        e.preventDefault();
        setComponentRect(selSurface, selId, { ...r, ...patch });
      };
      if (e.key === "ArrowLeft") nudge({ x: Math.max(0, r.x - step) });
      else if (e.key === "ArrowRight") nudge({ x: Math.min(1 - r.w, r.x + step) });
      else if (e.key === "ArrowUp") nudge({ y: Math.max(0, r.y - step) });
      else if (e.key === "ArrowDown") nudge({ y: Math.min(1 - r.h, r.y + step) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, config, removeComponent, setComponentRect, onSelect]);

  const pan = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    surface?: SurfaceId | null;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!view) return;
    const target = e.target as HTMLElement;
    const onControl = target.closest("[data-component],[data-stage-control]");
    const surfaceEl = target.closest<HTMLElement>("[data-surface]");
    const wantsPan = e.button === 1 || spaceHeld || !onControl;
    if (!wantsPan) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture unavailable — panning still works without it
    }
    pan.current = {
      x: e.clientX,
      y: e.clientY,
      tx: view.tx,
      ty: view.ty,
      // remember what to select if this turns out to be a click, not a drag
      surface: !onControl && e.button === 0 && !spaceHeld
        ? ((surfaceEl?.dataset.surface as SurfaceId | undefined) ?? null)
        : undefined,
      moved: false,
    };
    setPanning(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) > 4) p.moved = true;
    setView((v) => (v ? { ...v, tx: p.tx + dx, ty: p.ty + dy } : v));
  };
  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    if (!p.moved && p.surface !== undefined) {
      // a plain click on empty space: select that surface, or clear on the backdrop
      onSelect(p.surface ? { surface: p.surface, id: null } : null);
    }
    pan.current = null;
    setPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  };

  const zoomButton = (dir: 1 | -1) =>
    setView((v) =>
      v ? zoomAround(v, v.scale * (dir === 1 ? ZOOM_BTN : 1 / ZOOM_BTN), w / 2, h / 2) : v,
    );

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-stage" aria-label="Arc stage">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 36%, color-mix(in oklch, var(--foreground) 6%, transparent), transparent 62%)",
        }}
      />

      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 touch-none overflow-hidden",
          panning ? "cursor-grabbing" : spaceHeld ? "cursor-grab" : "cursor-default",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {view && (
          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              transform: `translate(${view.tx}px, ${view.ty}px)`,
              width: STAGE_BOX.w * view.scale,
              height: STAGE_BOX.h * view.scale,
            }}
          >
            <StageDecor scale={view.scale} />

            {SURFACES.map((surface) => {
              const p = getPlacement(surface.id);
              if (!p) return null;
              return (
                <ArcSurface
                  key={surface.id}
                  surfaceId={surface.id}
                  inputs={inputs}
                  cssW={p.w * view.scale}
                  cssH={p.h * view.scale}
                  className="absolute rounded-[2px] shadow-lg shadow-black/40 ring-1 ring-black/40"
                  style={{ left: p.x * view.scale, top: p.y * view.scale }}
                />
              );
            })}

            {/* component overlays + per-surface add affordance */}
            {SURFACES.map((surface) => {
              const p = getPlacement(surface.id);
              if (!p) return null;
              const list = config.surfaces[surface.id] ?? [];
              return (
                <div key={surface.id}>
                  {list.map((comp) => (
                    <ComponentFrame
                      key={comp.id}
                      comp={comp}
                      placement={p}
                      scale={view.scale}
                      selected={selected?.surface === surface.id && selected.id === comp.id}
                      siblings={list.filter((c) => c.id !== comp.id).map((c) => c.rect)}
                      onSelect={() => onSelect({ surface: surface.id, id: comp.id })}
                      onChange={(rect) => setComponentRect(surface.id, comp.id, rect)}
                      onGuides={(lines) =>
                        setGuides(lines.length ? { surface: surface.id, lines } : null)
                      }
                    />
                  ))}

                  {selected?.surface === surface.id && (
                    <AddComponentMenu
                      align="start"
                      onAdd={(type) => addComponent(surface.id, type)}
                      trigger={
                        <button
                          type="button"
                          data-stage-control
                          aria-label={`Add component to ${surface.label}`}
                          className="absolute z-40 flex items-center gap-1 rounded-md border border-border bg-popover/95 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
                          style={{ left: p.x * view.scale, top: p.y * view.scale - 22 }}
                        >
                          <Plus weight="bold" className="size-3" />
                          Add
                        </button>
                      }
                    />
                  )}

                  {/* alignment guides */}
                  {guides?.surface === surface.id &&
                    guides.lines.map((g, i) =>
                      g.axis === "x" ? (
                        <div
                          key={`x${i}`}
                          className="pointer-events-none absolute z-50 w-px bg-signal/80"
                          style={{
                            left: (p.x + g.pos * p.w) * view.scale,
                            top: p.y * view.scale,
                            height: p.h * view.scale,
                          }}
                        />
                      ) : (
                        <div
                          key={`y${i}`}
                          className="pointer-events-none absolute z-50 h-px bg-signal/80"
                          style={{
                            left: p.x * view.scale,
                            top: (p.y + g.pos * p.h) * view.scale,
                            width: p.w * view.scale,
                          }}
                        />
                      ),
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ZoomControls
        zoom={view?.scale ?? 1}
        onZoomIn={() => zoomButton(1)}
        onZoomOut={() => zoomButton(-1)}
        onFit={() => setView(fitView(w, h))}
      />
    </section>
  );
}

/** Gantry baseline + timing-tape ticks — grounds the arc as a physical structure. */
function StageDecor({ scale }: { scale: number }) {
  const top = getPlacement("topbar");
  const ticks = 33;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute h-px bg-stage-line"
        style={{ left: -24, right: -24, bottom: -1, width: "auto" }}
      />
      <div
        className="absolute h-2 bg-gradient-to-b from-stage-line/40 to-transparent"
        style={{ left: 0, right: 0, bottom: -2 }}
      />
      {top &&
        Array.from({ length: ticks }).map((_, i) => (
          <div
            key={i}
            className={cn("absolute w-px bg-stage-line", i % 8 === 0 ? "h-2.5" : "h-1.5")}
            style={{
              left: (top.x + (top.w * i) / (ticks - 1)) * scale,
              top: top.y * scale - 14,
            }}
          />
        ))}
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-popover/90 p-1 shadow-lg shadow-black/40 backdrop-blur">
      <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={onZoomOut}>
        <MagnifyingGlassMinus />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={onZoomIn}>
        <MagnifyingGlassPlus />
      </Button>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" onClick={onFit} aria-label="Fit arc to view">
        <CornersOut />
        Fit
      </Button>
    </div>
  );
}
