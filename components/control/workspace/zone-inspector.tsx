"use client";

import {
  AlignBottom,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignTop,
  ArrowLineDown,
  ArrowLineUp,
  ArrowUp,
  ArrowDown,
  CursorClick,
} from "@phosphor-icons/react";
import { memo } from "react";

import { ClockSection } from "@/components/control/clock-section";
import { FeedSettingsSection } from "@/components/control/feed-settings-section";
import { ZoneFields } from "@/components/control/zone-content-editor";
import type { ReorderDir } from "@/hooks/use-arc-config";
import type { FeedSettings } from "@/hooks/use-feed-settings";
import {
  CONTENT_TYPES,
  type ContentType,
  defaultContent,
  type ZoneContent,
} from "@/lib/arc/content";
import {
  type ArcConfig,
  type NormRect,
  type Selection,
} from "@/lib/arc/layout-model";
import { applyRectEdit, clamp } from "@/lib/arc/rect-edit";
import { componentPixelSize } from "@/lib/arc/stage-layout";
import { getSurface, type SurfaceId } from "@/lib/arc/surfaces";
import type { ConnectionStatus } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

import { CONTENT_META } from "./content-meta";
import { IconActionButton } from "./icon-action-button";

interface ClockControls {
  elapsed: number;
  running: boolean;
  mode: "elapsed" | "countdown";
  start: () => void;
  pause: () => void;
  reset: () => void;
  setElapsedMs: (ms: number) => void;
  startCountdown: (ms: number) => void;
  startAt: (epochMs: number) => void;
  startedAtMs: number | null;
}

export const ZoneInspector = memo(function ZoneInspector({
  selected,
  config,
  setComponentContent,
  setComponentRect,
  renameComponent,
  reorderComponent,
  feedSettings,
  updateFeed,
  feedStatus,
  clock,
}: {
  selected: Selection | null;
  config: ArcConfig;
  setComponentContent: (surface: SurfaceId, id: string, content: ZoneContent) => void;
  setComponentRect: (surface: SurfaceId, id: string, rect: NormRect) => void;
  renameComponent: (surface: SurfaceId, id: string, name: string) => void;
  reorderComponent: (surface: SurfaceId, id: string, dir: ReorderDir) => void;
  feedSettings: FeedSettings;
  updateFeed: (patch: Partial<FeedSettings>) => void;
  feedStatus: ConnectionStatus;
  clock: ClockControls;
}) {
  const selectedId = selected?.id ?? null;
  const selectedSurface = selected?.surface ?? null;
  const surface = selectedSurface ? getSurface(selectedSurface) : null;
  const comp =
    selectedSurface && selectedId
      ? config.surfaces[selectedSurface]?.find((c) => c.id === selectedId)
      : undefined;

  if (!selectedSurface || !selectedId || !surface || !comp) return <EmptyState />;

  const { content, rect } = comp;
  const meta = CONTENT_META[content.type];
  const px = componentPixelSize(selectedSurface, rect, config.surfaceSizes);
  const aspect = px.w / px.h;

  const setContent = (c: ZoneContent) => setComponentContent(selectedSurface, selectedId, c);
  const setRect = (r: NormRect) => setComponentRect(selectedSurface, selectedId, r);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Sticky: with a long settings list the operator otherwise loses track of
          which component they're editing. */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent">
          <meta.Icon size={18} weight="fill" className="text-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={comp.name ?? ""}
            placeholder={meta.label}
            onChange={(e) => renameComponent(selectedSurface, selectedId, e.target.value)}
            className="-mx-1 w-[calc(100%+0.5rem)] truncate rounded bg-transparent px-1 text-sm font-semibold outline-none transition-colors duration-150 placeholder:text-foreground focus:bg-muted focus:ring-3 focus:ring-ring/50 focus:placeholder:text-muted-foreground motion-reduce:transition-none"
            aria-label="Component name"
          />
          <p className="truncate text-xs text-muted-foreground">
            {surface.label} · {Math.round(px.w)}×{Math.round(px.h)} px
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-4">
        <Group label="Shows">
          <TypePicker value={content.type} onChange={(type) => setContent(defaultContent(type))} />
        </Group>

        <Group label={`${meta.label} settings`}>
          <ZoneFields content={content} onChange={setContent} aspect={aspect} />
        </Group>

        {content.type === "feed" && (
          <Group label="Live feed source">
            <FeedSettingsSection settings={feedSettings} update={updateFeed} status={feedStatus} />
          </Group>
        )}

        {content.type === "clock" && (
          <Group label="Race clock">
            <ClockSection
              elapsed={clock.elapsed}
              running={clock.running}
              mode={clock.mode}
              start={clock.start}
              pause={clock.pause}
              reset={clock.reset}
              setElapsedMs={clock.setElapsedMs}
              startCountdown={clock.startCountdown}
              startAt={clock.startAt}
              startedAtMs={clock.startedAtMs}
            />
          </Group>
        )}

        {/* Layout controls sit last for every component type, consistently. */}
        <Group label="Position & size">
          <PositionFields
            rect={rect}
            onChange={setRect}
            reorder={(dir) => reorderComponent(selectedSurface, selectedId, dir)}
          />
        </Group>
      </div>
    </div>
  );
});

function PositionFields({
  rect,
  onChange,
  reorder,
}: {
  rect: NormRect;
  onChange: (r: NormRect) => void;
  reorder: (dir: ReorderDir) => void;
}) {
  const set = (patch: Partial<NormRect>) => onChange(applyRectEdit(rect, patch));

  // A component is aligned when it is already sitting flush; the button shows it.
  const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="X" value={rect.x} onChange={(x) => set({ x })} />
        <NumField label="Y" value={rect.y} onChange={(y) => set({ y })} />
        <NumField label="W" value={rect.w} onChange={(w) => set({ w })} />
        <NumField label="H" value={rect.h} onChange={(h) => set({ h })} />
      </div>

      <Row label="Align">
        <IconActionButton
          label="Align left"
          active={near(rect.x, 0)}
          onClick={() => set({ x: 0 })}
          className="flex-1"
        >
          <AlignLeft className="size-4" />
        </IconActionButton>
        <IconActionButton
          label="Center horizontally"
          active={near(rect.x, (1 - rect.w) / 2)}
          onClick={() => set({ x: (1 - rect.w) / 2 })}
          className="flex-1"
        >
          <AlignCenterVertical className="size-4" />
        </IconActionButton>
        <IconActionButton
          label="Align right"
          active={near(rect.x, 1 - rect.w)}
          onClick={() => set({ x: 1 - rect.w })}
          className="flex-1"
        >
          <AlignRight className="size-4" />
        </IconActionButton>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <IconActionButton
          label="Align top"
          active={near(rect.y, 0)}
          onClick={() => set({ y: 0 })}
          className="flex-1"
        >
          <AlignTop className="size-4" />
        </IconActionButton>
        <IconActionButton
          label="Center vertically"
          active={near(rect.y, (1 - rect.h) / 2)}
          onClick={() => set({ y: (1 - rect.h) / 2 })}
          className="flex-1"
        >
          <AlignCenterHorizontal className="size-4" />
        </IconActionButton>
        <IconActionButton
          label="Align bottom"
          active={near(rect.y, 1 - rect.h)}
          onClick={() => set({ y: 1 - rect.h })}
          className="flex-1"
        >
          <AlignBottom className="size-4" />
        </IconActionButton>
      </Row>

      <Row label="Fill">
        <button
          type="button"
          onClick={() => onChange({ x: 0, y: 0, w: 1, h: 1 })}
          className="h-7 flex-1 rounded-md border border-input text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Whole surface
        </button>
        <button
          type="button"
          onClick={() => set({ x: (1 - rect.w) / 2, y: (1 - rect.h) / 2 })}
          className="h-7 flex-1 rounded-md border border-input text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Center
        </button>
      </Row>

      <Row label="Layer">
        <IconActionButton label="Bring to front" onClick={() => reorder("front")} className="flex-1">
          <ArrowLineUp className="size-4" />
        </IconActionButton>
        <IconActionButton label="Bring forward" onClick={() => reorder("forward")} className="flex-1">
          <ArrowUp className="size-4" />
        </IconActionButton>
        <IconActionButton label="Send backward" onClick={() => reorder("backward")} className="flex-1">
          <ArrowDown className="size-4" />
        </IconActionButton>
        <IconActionButton label="Send to back" onClick={() => reorder("back")} className="flex-1">
          <ArrowLineDown className="size-4" />
        </IconActionButton>
      </Row>
    </div>
  );
}

/**
 * A labelled row of controls. The label sits above rather than inline: in a
 * ~300px rail an inline label squeezed six align buttons into the right edge.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 transition-colors duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 motion-reduce:transition-none">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        // Half a percent of the 1280px topbar is ~6px. Whole-percent steps were
        // coarser than dragging on the stage, so typing re-snapped the component.
        step={0.5}
        value={Math.round(value * 1000) / 10}
        onChange={(e) => onChange(clamp((Number(e.target.value) || 0) / 100, 0, 1))}
        className="h-8 w-full bg-transparent text-sm tabular-nums outline-none"
      />
      <span className="text-xs text-muted-foreground">%</span>
    </label>
  );
}

/**
 * The content-type palette — the heart of "customizing" a component.
 *
 * Icon-only and compact, like a tool strip; the name is a tooltip rather than
 * baked into every tile. A fixed five-column grid, so ten types read as two even
 * rows instead of the ragged seven-then-three a flex wrap produced.
 */
function TypePicker({
  value,
  onChange,
}: {
  value: ContentType;
  onChange: (type: ContentType) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {CONTENT_TYPES.map(({ type }) => {
        const meta = CONTENT_META[type];
        const active = type === value;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            aria-pressed={active}
            aria-label={meta.label}
            title={meta.label}
            className={cn(
              "grid aspect-square w-full place-items-center rounded-lg border outline-none transition-colors duration-150 motion-reduce:transition-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              "active:not-aria-[haspopup]:translate-y-px",
              active
                ? "border-signal/60 bg-signal/10 text-signal"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <meta.Icon size={17} weight={active ? "fill" : "regular"} />
          </button>
        );
      })}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="px-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="grid size-11 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
        <CursorClick size={20} />
      </span>
      <p className="text-sm font-medium">No component selected</p>
      <p className="max-w-52 text-xs text-muted-foreground">
        Click a component on the arc or in the layers list, or use “Add” to install a new one.
      </p>
    </div>
  );
}
