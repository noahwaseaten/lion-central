"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ZoneContent } from "@/lib/arc/content";
import { getImage } from "@/lib/arc/render/assets";
import { drawTransformed } from "@/lib/arc/render/zones";

type ImageContent = Extract<ZoneContent, { type: "image" }>;

const MAX_PREVIEW_W = 288;
const MAX_PREVIEW_H = 184;
const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Direct-manipulation crop/place editor for an image component: drag the preview
 * to pan, scroll to zoom toward the cursor, with Fit/Fill/Reset, zoom and padding
 * sliders, and a background fill. The preview is drawn by the same painter the
 * output uses, so what you see is exactly what renders.
 */
export function ImageCropEditor({
  content,
  onChange,
  aspect,
}: {
  content: ImageContent;
  onChange: (next: ImageContent) => void;
  /** width / height of the component, so the preview matches the real frame. */
  aspect: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  // Preview box dimensions from the component's aspect ratio.
  const pw = aspect >= 1 ? MAX_PREVIEW_W : Math.round(MAX_PREVIEW_H * aspect);
  const ph = aspect >= 1 ? Math.round(MAX_PREVIEW_W / aspect) : MAX_PREVIEW_H;
  const w = Math.min(pw, MAX_PREVIEW_W);
  const h = Math.min(ph, MAX_PREVIEW_H);

  // Redraw the preview each frame so it tracks edits and image loading.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      const c = contentRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Checkerboard so transparent / letterboxed areas read as "outside the frame".
      paintChecker(ctx, canvas.width, canvas.height);
      if (c.background) {
        ctx.fillStyle = c.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const img = getImage(c.src);
      if (img && img.naturalWidth > 0) {
        drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, canvas.width, canvas.height, c);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const inner = useCallback(() => {
    const pad = Math.min(w, h) * content.padding;
    return { pad, iw: Math.max(1, w - pad * 2), ih: Math.max(1, h - pad * 2) };
  }, [w, h, content.padding]);

  // Pan on drag.
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!content.src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: content.offset.x, oy: content.offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { iw, ih } = inner();
    onChange({
      ...content,
      offset: { x: d.ox + (e.clientX - d.x) / iw, y: d.oy + (e.clientY - d.y) / ih },
    });
  };
  const endDrag = (e: React.PointerEvent) => {
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  };

  // Zoom toward the cursor on wheel.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = contentRef.current;
      const img = getImage(c.src);
      const next = clamp(c.scale * Math.exp(-e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);
      if (!img || img.naturalWidth === 0) {
        onChange({ ...c, scale: next });
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * w;
      const cy = ((e.clientY - rect.top) / rect.height) * h;
      const pad = Math.min(w, h) * c.padding;
      const iw = Math.max(1, w - pad * 2);
      const ih = Math.max(1, h - pad * 2);
      const mw = img.naturalWidth;
      const mh = img.naturalHeight;
      const baseline = c.fit === "cover" ? Math.max(iw / mw, ih / mh) : Math.min(iw / mw, ih / mh);
      const ix = cx - pad;
      const iy = cy - pad;
      const s0 = baseline * c.scale;
      const s1 = baseline * next;
      const dx0 = (iw - mw * s0) / 2 + c.offset.x * iw;
      const dy0 = (ih - mh * s0) / 2 + c.offset.y * ih;
      const imgX = (ix - dx0) / s0;
      const imgY = (iy - dy0) / s0;
      const dx1 = ix - imgX * s1;
      const dy1 = iy - imgY * s1;
      onChange({
        ...c,
        scale: next,
        offset: { x: (dx1 - (iw - mw * s1) / 2) / iw, y: (dy1 - (ih - mh * s1) / 2) / ih },
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [w, h, onChange]);

  const reset = (patch: Partial<ImageContent>) =>
    onChange({ ...content, scale: 1, offset: { x: 0, y: 0 }, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <SrcField content={content} onChange={onChange} />

      <div className="flex flex-col items-center gap-2">
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ width: w, height: h }}
          className={`touch-none rounded-md border border-input ${content.src ? "cursor-grab active:cursor-grabbing" : ""}`}
          aria-label="Image crop preview — drag to pan, scroll to zoom"
        />
        {content.src && (
          <p className="text-[11px] text-muted-foreground">Drag to pan · scroll to zoom</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => reset({ fit: "contain" })}>
          Fit
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => reset({ fit: "cover" })}>
          Fill
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => reset({})}>
          <ArrowCounterClockwise />
          Reset
        </Button>
      </div>

      <Slider
        label="Zoom"
        value={content.scale}
        min={MIN_SCALE}
        max={4}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(scale) => onChange({ ...content, scale })}
      />
      <Slider
        label="Padding"
        value={content.padding}
        min={0}
        max={0.4}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(padding) => onChange({ ...content, padding })}
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Background</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={content.background ?? "#000000"}
            onChange={(e) => onChange({ ...content, background: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded-md border border-input bg-background"
            aria-label="Background color"
          />
          <Button
            type="button"
            variant={content.background ? "ghost" : "outline"}
            size="sm"
            onClick={() => onChange({ ...content, background: content.background ? null : "#000000" })}
          >
            {content.background ? "Clear" : "None"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SrcField({
  content,
  onChange,
}: {
  content: ImageContent;
  onChange: (next: ImageContent) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isData = content.src.startsWith("data:");

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => onChange({ ...content, src: String(r.result) });
    r.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        value={isData ? "" : content.src}
        placeholder={isData ? "(uploaded image)" : "https://…"}
        onChange={(e) => onChange({ ...content, src: e.target.value })}
        aria-label="Image URL"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onUpload(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        {content.src ? "Replace image…" : "Upload image…"}
      </Button>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        <span className="tabular-nums text-foreground">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-signal"
      />
    </label>
  );
}

function paintChecker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const s = 8;
  ctx.fillStyle = "#1c1f26";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#262a33";
  for (let y = 0; y < h; y += s) {
    for (let x = 0; x < w; x += s) {
      if (((x / s) + (y / s)) % 2 === 0) ctx.fillRect(x, y, s, s);
    }
  }
}
