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
  CursorClick,
} from "@phosphor-icons/react";

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
import { componentPixelSize } from "@/lib/arc/stage-layout";
import { getSurface, type SurfaceId } from "@/lib/arc/surfaces";
import type { ConnectionStatus } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

import { CONTENT_META } from "./content-meta";

interface ClockControls {
  elapsed: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setElapsedMs: (ms: number) => void;
}

export function ZoneInspector({
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
  if (!selected) return <EmptyState />;

  if (selected.id === null) return <EmptyState />;
  const { surface: selectedSurface, id: selectedId } = selected as { surface: typeof selected.surface; id: string };
  const surface = getSurface(selectedSurface);
  const comp = config.surfaces[selectedSurface]?.find((c) => c.id === selectedId);
  if (!surface || !comp) return <EmptyState />;

  const { content, rect } = comp;
  const meta = CONTENT_META[content.type];
  const px = componentPixelSize(selectedSurface, rect);
  const aspect = px.w / px.h;

  const setContent = (c: ZoneContent) => setComponentContent(selectedSurface, selectedId, c);
  const setRect = (r: NormRect) => setComponentRect(selectedSurface, selectedId, r);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent">
          <meta.Icon size={18} weight="fill" className="text-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={comp.name ?? ""}
            placeholder={meta.label}
            onChange={(e) => renameComponent(selectedSurface, selectedId, e.target.value)}
            className="w-full truncate bg-transparent text-sm font-semibold outline-none placeholder:text-foreground focus:placeholder:text-muted-foreground"
            aria-label="Component name"
          />
          <p className="truncate text-xs text-muted-foreground">{surface.label}</p>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-4">
        <Group label="Shows">
          <TypePicker value={content.type} onChange={(type) => setContent(defaultContent(type))} />
        </Group>

        <Group label="Settings">
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
              start={clock.start}
              pause={clock.pause}
              reset={clock.reset}
              setElapsedMs={clock.setElapsedMs}
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
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function PositionFields({
  rect,
  onChange,
  reorder,
}: {
  rect: NormRect;
  onChange: (r: NormRect) => void;
  reorder: (dir: ReorderDir) => void;
}) {
  const set = (patch: Partial<NormRect>) => {
    const next = { ...rect, ...patch };
    next.w = Math.min(1, Math.max(0.04, next.w));
    next.h = Math.min(1, Math.max(0.04, next.h));
    next.x = clamp01(Math.min(next.x, 1 - next.w));
    next.y = clamp01(Math.min(next.y, 1 - next.h));
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="X" value={rect.x} onChange={(x) => set({ x })} />
        <NumField label="Y" value={rect.y} onChange={(y) => set({ y })} />
        <NumField label="W" value={rect.w} onChange={(w) => set({ w })} />
        <NumField label="H" value={rect.h} onChange={(h) => set({ h })} />
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Align
        </span>
        <AlignBtn label="Left" onClick={() => set({ x: 0 })}>
          <AlignLeft />
        </AlignBtn>
        <AlignBtn label="Center" onClick={() => set({ x: (1 - rect.w) / 2 })}>
          <AlignCenterVertical />
        </AlignBtn>
        <AlignBtn label="Right" onClick={() => set({ x: 1 - rect.w })}>
          <AlignRight />
        </AlignBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <AlignBtn label="Top" onClick={() => set({ y: 0 })}>
          <AlignTop />
        </AlignBtn>
        <AlignBtn label="Middle" onClick={() => set({ y: (1 - rect.h) / 2 })}>
          <AlignCenterHorizontal />
        </AlignBtn>
        <AlignBtn label="Bottom" onClick={() => set({ y: 1 - rect.h })}>
          <AlignBottom />
        </AlignBtn>
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Layer
        </span>
        <AlignBtn label="Bring to front" onClick={() => reorder("front")}>
          <ArrowLineUp />
        </AlignBtn>
        <AlignBtn label="Send to back" onClick={() => reorder("back")}>
          <ArrowLineDown />
        </AlignBtn>
      </div>
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
    <label className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(clamp01((Number(e.target.value) || 0) / 100))}
        className="h-8 w-full bg-transparent text-sm outline-none"
      />
      <span className="text-xs text-muted-foreground">%</span>
    </label>
  );
}

function AlignBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/** The content-type palette — the heart of "customizing" a component. */
function TypePicker({
  value,
  onChange,
}: {
  value: ContentType;
  onChange: (type: ContentType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {CONTENT_TYPES.map(({ type }) => {
        const meta = CONTENT_META[type];
        const active = type === value;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm outline-none transition-colors duration-150 motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-signal/60 bg-signal/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <meta.Icon
              size={16}
              weight={active ? "fill" : "regular"}
              className={cn("shrink-0", active ? "text-signal" : "text-muted-foreground")}
            />
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-1.5">
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
