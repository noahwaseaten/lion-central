"use client";

import { useState } from "react";

import { ImageCropEditor } from "@/components/control/image-crop-editor";
import { LogoLibrary } from "@/components/control/logo-library";
import { defaultTransform, type Fit, type ImageTransform, type SponsorItem, type ZoneContent } from "@/lib/arc/content";

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
          <Toggle
            label="Animated digits (NumberFlow)"
            checked={content.numberFlow}
            onChange={(numberFlow) => onChange({ ...content, numberFlow })}
          />
          <Hint>Smoothly rolls the digits as the clock ticks. Timing is set in &ldquo;Race clock&rdquo;.</Hint>
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
          <LogoLibrary
            onPick={(url) => onChange({ ...content, src: content.src === url ? "" : url })}
            selected={content.src ? [content.src] : []}
          />
        </div>
      );
    case "video":
      return <VideoFields content={content} onChange={onChange} />;
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

  // Toggle a logo's membership; new logos get a default transform.
  const toggle = (url: string) => {
    const has = srcs.includes(url);
    const items: SponsorItem[] = has
      ? content.items.filter((i) => i.src !== url)
      : [...content.items, { src: url, ...defaultTransform() }];
    onChange({ ...content, items });
  };

  const patchItem = (src: string, t: ImageTransform) =>
    onChange({
      ...content,
      items: content.items.map((i) => (i.src === src ? { ...i, ...t } : i)),
    });

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

      <LogoLibrary onPick={toggle} selected={srcs} />

      {content.items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {content.items.length} logo{content.items.length === 1 ? "" : "s"} — click to crop
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...content, items: [] })}
              className="rounded px-1.5 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </button>
          </div>

          {content.items.map((item) => (
            <div key={item.src} className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setOpenSrc((s) => (s === item.src ? null : item.src))}
                aria-expanded={openSrc === item.src}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logo, not a build asset */}
                <img src={item.src} alt="" className="size-6 shrink-0 rounded object-contain" />
                <span className="flex-1 truncate text-muted-foreground">{item.src.split("/").pop()}</span>
              </button>
              {openSrc === item.src && (
                <div className="border-t border-border p-2">
                  <ImageCropEditor
                    src={item.src}
                    transform={item}
                    aspect={cellAspect}
                    onChange={(t) => patchItem(item.src, t)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
      <div className="flex gap-4">
        <Toggle label="Loop" checked={content.loop} onChange={(loop) => onChange({ ...content, loop })} />
        <Toggle label="Muted" checked={content.muted} onChange={(muted) => onChange({ ...content, muted })} />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
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

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
