"use client";

import { useRef, useState } from "react";

import { ImageCropEditor } from "@/components/control/image-crop-editor";
import { Button } from "@/components/ui/button";
import { type Fit, type ZoneContent } from "@/lib/arc/content";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const labelCls = "text-xs font-medium text-muted-foreground";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

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
    case "feed":
      return <Hint>Shows the live athlete feed (controlled in “Live feed” below).</Hint>;
    case "clock":
      return <Hint>Shows the race clock (controlled in “Race clock” below).</Hint>;
    case "off":
      return <Hint>Blank (black) — useful to clear part of a surface.</Hint>;
    case "text":
      return <TextFields content={content} onChange={onChange} />;
    case "sponsors":
      return <SponsorFields content={content} onChange={onChange} />;
    case "image":
      return <ImageCropEditor content={content} onChange={onChange} aspect={aspect} />;
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
}: {
  content: Extract<ZoneContent, { type: "sponsors" }>;
  onChange: (next: ZoneContent) => void;
}) {
  const [draft, setDraft] = useState(content.images.join("\n"));
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = (text: string) => {
    setDraft(text);
    onChange({ ...content, images: text.split("\n").map((s) => s.trim()).filter(Boolean) });
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const urls = await Promise.all(Array.from(files).map(readFileAsDataURL));
    const next = [...content.images, ...urls];
    setDraft(next.join("\n"));
    onChange({ ...content, images: next });
    if (fileRef.current) fileRef.current.value = "";
  };

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
          <Field label="Cell padding">
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

      <Field label="Logo URLs (one per line)">
        <textarea
          className={`${inputCls} h-24 resize-y py-2`}
          placeholder="https://… or upload below"
          value={draft}
          onChange={(e) => commit(e.target.value)}
        />
      </Field>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void onUpload(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        Upload logos…
      </Button>
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
