"use client";

import { ArrowDown, ArrowUp, X } from "@phosphor-icons/react";
import { useState } from "react";

import { AssetThumb } from "@/components/control/asset-thumb";
import { ImageCropEditor } from "@/components/control/image-crop-editor";
import { MediaLibraryTrigger } from "@/components/control/media-library";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { assetDisplayName } from "@/lib/arc/assets-shared";
import {
  applyFramingToAll,
  framingOf,
  moveItem,
  removeAt,
} from "@/lib/arc/sponsor-items";
import {
  defaultTransform,
  type Fit,
  type ImageTransform,
  type SponsorItem,
  WEATHER_CONDITIONS,
  type WeatherCondition,
  type ZoneContent,
} from "@/lib/arc/content";
import { cn } from "@/lib/utils";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const labelCls = "text-xs font-medium text-muted-foreground";

/**
 * The type-specific fields for a component's content (no type selector — that
 * lives in the inspector). Calls `onChange` with the new `ZoneContent` on every
 * edit. `aspect` is the component's width/height, used to size the image preview.
 */
export function ZoneFields({
  content,
  onChange,
  aspect,
}: {
  content: ZoneContent;
  onChange: (next: ZoneContent) => void;
  aspect: number;
}) {
  switch (content.type) {
    case "clock":
      return (
        <div className="flex flex-col gap-2">
          <Switch
            label="Animated digits (NumberFlow)"
            checked={content.numberFlow}
            onCheckedChange={(numberFlow) => onChange({ ...content, numberFlow })}
          />
        </div>
      );
    case "text":
      return <TextFields content={content} onChange={onChange} />;
    case "sponsors":
      return <SponsorFields content={content} onChange={onChange} aspect={aspect} />;
    case "image":
      return (
        <div className="flex flex-col gap-3">
          <ImageCropEditor
            src={content.src}
            transform={content}
            aspect={aspect}
            onChange={(t) => onChange({ ...content, ...t })}
            onSrcChange={(src) => onChange({ ...content, src })}
          />
          <MediaLibraryTrigger
            mode="single"
            selected={content.src ? [content.src] : []}
            onPick={(url) => onChange({ ...content, src: content.src === url ? "" : url })}
          />
        </div>
      );
    case "video":
      return <VideoFields content={content} onChange={onChange} />;
    case "qr":
      return <QrFields content={content} onChange={onChange} />;
    case "weather":
      return <WeatherFields content={content} onChange={onChange} />;
    case "color":
      return (
        <label className="flex items-center justify-between gap-3 text-sm">
          Color
          <input
            type="color"
            value={content.color}
            onChange={(e) => onChange({ ...content, color: e.target.value })}
            className="h-9 w-16 cursor-pointer rounded-md border border-input bg-background"
          />
        </label>
      );
  }
}

function TextFields({
  content,
  onChange,
}: {
  content: Extract<ZoneContent, { type: "text" }>;
  onChange: (next: ZoneContent) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Title">
        <input
          className={inputCls}
          value={content.title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
        />
      </Field>
      <Field label="Subtitle">
        <input
          className={inputCls}
          value={content.subtitle ?? ""}
          onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
        />
      </Field>
    </div>
  );
}

function QrFields({
  content,
  onChange,
}: {
  content: Extract<ZoneContent, { type: "qr" }>;
  onChange: (next: ZoneContent) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>URL</label>
        <input
          type="url"
          value={content.url}
          onChange={(e) => onChange({ ...content, url: e.target.value })}
          placeholder="https://results.example.com"
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Label</label>
        <input
          type="text"
          value={content.label}
          onChange={(e) => onChange({ ...content, label: e.target.value })}
          placeholder="Scan for results"
          className={inputCls}
        />
      </div>
    </div>
  );
}

function WeatherFields({
  content,
  onChange,
}: {
  content: Extract<ZoneContent, { type: "weather" }>;
  onChange: (next: ZoneContent) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Operator-set — type in the current conditions, no sensor or forecast hookup.
      </p>
      <div className="flex gap-2">
        <Field label="Temperature (°C)">
          <input
            type="number"
            step={1}
            value={content.tempC}
            onChange={(e) => onChange({ ...content, tempC: Number(e.target.value) || 0 })}
            className={inputCls}
          />
        </Field>
        <Field label="Wind (km/h)">
          <input
            type="number"
            min={0}
            step={1}
            value={content.windKph}
            onChange={(e) => onChange({ ...content, windKph: Math.max(0, Number(e.target.value) || 0) })}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Field label="Wind direction">
          <input
            type="text"
            value={content.windDir}
            onChange={(e) => onChange({ ...content, windDir: e.target.value.slice(0, 4).toUpperCase() })}
            placeholder="NW"
            maxLength={4}
            className={inputCls}
          />
        </Field>
        <Field label="Condition">
          <select
            value={content.condition}
            onChange={(e) => onChange({ ...content, condition: e.target.value as WeatherCondition })}
            className={inputCls}
          >
            {WEATHER_CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

function SponsorFields({
  content,
  onChange,
  aspect,
}: {
  content: Extract<ZoneContent, { type: "sponsors" }>;
  onChange: (next: ZoneContent) => void;
  aspect: number;
}) {
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const srcs = content.items.map((i) => i.src);
  const setItems = (items: SponsorItem[]) => onChange({ ...content, items });

  // Toggle a logo's membership; new logos get a default transform.
  const toggle = (url: string) => {
    setItems(
      srcs.includes(url)
        ? content.items.filter((i) => i.src !== url)
        : [...content.items, { src: url, ...defaultTransform() }],
    );
  };

  const patchItem = (src: string, t: ImageTransform) =>
    setItems(content.items.map((i) => (i.src === src ? { ...i, ...t } : i)));

  // Each cell's aspect ≈ component aspect ÷ columns-vs-rows; component aspect is a
  // good-enough preview ratio for per-logo cropping.
  const cellAspect = aspect;

  return (
    <div className="flex flex-col gap-3">
      <Field label="Mode">
        <select
          className={inputCls}
          value={content.mode}
          onChange={(e) => onChange({ ...content, mode: e.target.value as "rotate" | "grid" })}
        >
          <option value="grid">Grid (squares, all at once)</option>
          <option value="rotate">Rotate (one at a time)</option>
        </select>
      </Field>

      {content.mode === "grid" ? (
        <div className="flex gap-3">
          <Field label="Columns">
            <select
              className={inputCls}
              value={content.columns === "auto" ? "auto" : String(content.columns)}
              onChange={(e) =>
                onChange({
                  ...content,
                  columns: e.target.value === "auto" ? "auto" : Number(e.target.value),
                })
              }
            >
              <option value="auto">Auto</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gap">
            <input
              type="number"
              min={0}
              max={40}
              step={1}
              className={inputCls}
              value={Math.round(content.cellPadding * 100)}
              onChange={(e) =>
                onChange({
                  ...content,
                  cellPadding: Math.min(0.4, Math.max(0, (Number(e.target.value) || 0) / 100)),
                })
              }
            />
          </Field>
        </div>
      ) : (
        <Field label="Rotate interval (seconds)">
          <input
            type="number"
            min={1}
            step={1}
            className={inputCls}
            value={Math.round(content.intervalMs / 1000)}
            onChange={(e) =>
              onChange({ ...content, intervalMs: Math.max(1, Number(e.target.value) || 1) * 1000 })
            }
          />
        </Field>
      )}

      <MediaLibraryTrigger mode="multi" selected={srcs} onPick={toggle} />

      <SponsorList
        items={content.items}
        cellAspect={cellAspect}
        openSrc={openSrc}
        onToggleOpen={(src) => setOpenSrc((s) => (s === src ? null : src))}
        onItems={setItems}
        onPatch={patchItem}
      />
    </div>
  );
}

/**
 * The per-logo list.
 *
 * Order is meaningful — it is the grid's placement and the rotation's sequence —
 * so it is editable here rather than being an accident of the order you clicked
 * things in the library. Each row can be removed on its own, and one row's
 * framing can be pushed across the board instead of being repeated by hand.
 */
function SponsorList({
  items,
  cellAspect,
  openSrc,
  onToggleOpen,
  onItems,
  onPatch,
}: {
  items: SponsorItem[];
  cellAspect: number;
  openSrc: string | null;
  onToggleOpen: (src: string) => void;
  onItems: (items: SponsorItem[]) => void;
  onPatch: (src: string, t: ImageTransform) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        No logos yet. Browse the library to add some.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={labelCls}>
          {items.length} logo{items.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => onItems([])}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear
        </button>
      </div>

      {items.map((item, index) => {
        const isOpen = item.src === openSrc;
        const name = assetDisplayName(item.src);
        return (
          <div
            key={item.src}
            className={cn("rounded-md border", isOpen ? "border-ring" : "border-border")}
          >
            <div className="flex items-center gap-1 pr-1">
              <button
                type="button"
                onClick={() => onToggleOpen(item.src)}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <AssetThumb src={item.src} className="size-6 rounded" />
                <span className="min-w-0 flex-1 truncate text-muted-foreground" title={name}>
                  {name}
                </span>
              </button>

              <RowButton
                label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => onItems(moveItem(items, index, index - 1))}
              >
                <ArrowUp />
              </RowButton>
              <RowButton
                label={`Move ${name} down`}
                disabled={index === items.length - 1}
                onClick={() => onItems(moveItem(items, index, index + 1))}
              >
                <ArrowDown />
              </RowButton>
              <RowButton
                label={`Remove ${name}`}
                onClick={() => onItems(removeAt(items, index))}
                className="hover:text-destructive"
              >
                <X />
              </RowButton>
            </div>

            {isOpen && (
              <div className="flex flex-col gap-2 border-t border-border p-2">
                <ImageCropEditor
                  src={item.src}
                  transform={item}
                  aspect={cellAspect}
                  onChange={(t) => onPatch(item.src, t)}
                />
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onItems(applyFramingToAll(items, framingOf(item)))}
                  >
                    Use this framing for all logos
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded text-muted-foreground outline-none transition-colors",
        "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5",
        className,
      )}
    >
      {children}
    </button>
  );
}

function VideoFields({
  content,
  onChange,
}: {
  content: Extract<ZoneContent, { type: "video" }>;
  onChange: (next: ZoneContent) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Video URL">
        <input
          className={inputCls}
          value={content.src}
          placeholder="https://….mp4"
          onChange={(e) => onChange({ ...content, src: e.target.value })}
        />
      </Field>
      <Field label="Fit">
        <select
          className={inputCls}
          value={content.fit}
          onChange={(e) => onChange({ ...content, fit: e.target.value as Fit })}
        >
          <option value="contain">Contain (whole video)</option>
          <option value="cover">Cover (fill, may crop)</option>
        </select>
      </Field>
      <div className="flex flex-col gap-2">
        <Switch label="Loop" checked={content.loop} onCheckedChange={(loop) => onChange({ ...content, loop })} />
        <Switch label="Muted" checked={content.muted} onCheckedChange={(muted) => onChange({ ...content, muted })} />
      </div>
    </div>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

