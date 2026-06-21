# Arc Display: Announcement, QR Code, Background Pulse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three display features to the Lion Central arc: an operator-broadcast announcement overlay on all surfaces, a QR code component type, and a subtle background colour pulse when athletes check in.

**Architecture:** `SurfaceInputs` is extended with an `announcement` field and two new `feed` sub-fields (`lastArrivalMs`, `lastArrivalSplit`). New hooks (`useAnnouncement`, `useLastArrival`) wire into the two places that assemble `SurfaceInputs` (the output-only `useArcInputs` and the workspace `ArcWorkspace`). The compositor draws the background pulse wash before the component stack and the announcement overlay after it. QR is a new synchronous canvas painter using the `qrcode` npm package.

**Tech Stack:** TypeScript strict, React 19, Next.js 16 App Router, Vitest (pure-logic only), `qrcode` + `@types/qrcode` (new), canvas 2D API, localStorage for cross-tab state, `@phosphor-icons/react`, shadcn `Popover`/`Button` (Base UI variant)

## Global Constraints

- `pnpm` only — no `npm`/`yarn`
- Tailwind only — no inline styles
- Named exports everywhere; default exports only for Next.js pages
- Vitest tests in `lib/**/*.test.ts` files, co-located with source; canvas/DOM never tested
- Announcement background: `#0f172a` (deep navy, NOT black)
- `AnnouncementRecord` type lives in `lib/arc/render/inputs.ts` (shared between render and hook layers)
- Popover component from `@/components/ui/popover` uses Base UI API: `<PopoverTrigger render={<Button …/>} />`

---

### Task 1: Install `qrcode`, extend `SurfaceInputs`, export helpers from `zones.ts`

This is the foundation all other tasks build on. It extends the shared type contract and makes internal canvas helpers available to `compositor.ts`.

**Files:**
- Modify: `lib/arc/render/inputs.ts`
- Modify: `lib/arc/render/zones.ts`
- Modify: `hooks/use-arc-inputs.ts` (add placeholder values to satisfy TypeScript immediately)
- Modify: `components/control/workspace/arc-workspace.tsx` (same)

**Interfaces:**
- Produces:
  - `AnnouncementRecord` interface (exported from `inputs.ts`)
  - `SurfaceInputs.announcement: AnnouncementRecord | null`
  - `SurfaceInputs.feed.lastArrivalMs: number`
  - `SurfaceInputs.feed.lastArrivalSplit: Split | null`
  - `export SPLIT_COLOR`, `export hexA`, `export fitFont` from `zones.ts`

- [ ] **Step 1: Install qrcode**

```bash
pnpm add qrcode
pnpm add -D @types/qrcode
```

Expected: pnpm resolves and writes `pnpm-lock.yaml` with `qrcode` added.

- [ ] **Step 2: Extend `lib/arc/render/inputs.ts`**

Replace the entire file:

```ts
import type { ConnectionStatus, FeedEntry } from "@/lib/feed/types";
import type { Split } from "@/lib/feed/types";

import type { ArcConfig } from "../content";

export interface AnnouncementRecord {
  text: string;
  subtitle?: string;
  startedAt: number; // Date.now() ms
  endsAt: number;    // Date.now() ms
}

/** Everything the compositor needs to draw any surface at a given frame. */
export interface SurfaceInputs {
  config: ArcConfig;
  feed: {
    entries: FeedEntry[];
    status: ConnectionStatus;
    /** performance.now() timestamp when the newest unique entry first appeared; 0 if none yet. */
    lastArrivalMs: number;
    /** Split of the athlete whose arrival set lastArrivalMs; null if none yet. */
    lastArrivalSplit: Split | null;
  };
  clock: { ms: number; running: boolean };
  /** Active announcement to overlay on all surfaces; null when none. */
  announcement: AnnouncementRecord | null;
}
```

- [ ] **Step 3: Fix `hooks/use-arc-inputs.ts` — add placeholder fields**

Replace the `return useMemo` block. The file currently returns `{ config, feed: { entries, status }, clock: { ms: elapsed, running } }`. Update it to satisfy the new shape with zeros/nulls for the new fields (the real hooks fill these in later tasks):

```ts
  return useMemo<SurfaceInputs>(
    () => ({
      config,
      feed: { entries, status, lastArrivalMs: 0, lastArrivalSplit: null },
      clock: { ms: elapsed, running },
      announcement: null,
    }),
    [config, entries, status, elapsed, running],
  );
```

- [ ] **Step 4: Fix `components/control/workspace/arc-workspace.tsx` — add placeholder fields**

Find the `const inputs: SurfaceInputs = {` block (currently around line 65) and update:

```ts
  const inputs: SurfaceInputs = {
    config,
    feed: { entries, status, lastArrivalMs: 0, lastArrivalSplit: null },
    clock: { ms: elapsed, running },
    announcement: null,
  };
```

- [ ] **Step 5: Export helpers from `lib/arc/render/zones.ts`**

Add `export` to three existing internal functions. Find each declaration and add `export`:

```ts
// Change: const SPLIT_COLOR → export const SPLIT_COLOR
export const SPLIT_COLOR: Record<Split, string> = {
  swim: "#0284c7",
  bike: "#ea580c",
  run: "#059669",
};

// Change: function fitFont → export function fitFont
export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxPx: number,
  weight: string,
): number {
  let px = Math.floor(maxPx);
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 2;
  } while (px > 8);
  return px;
}

// Change: function hexA → export function hexA
export function hexA(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return hex.length === 7 ? hex + a : hex;
}
```

(All existing internal callers of `SPLIT_COLOR`, `fitFont`, and `hexA` within `zones.ts` remain unchanged — they just now also have an export binding.)

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors (or only pre-existing errors unrelated to these files).

- [ ] **Step 7: Commit**

```bash
git add lib/arc/render/inputs.ts lib/arc/render/zones.ts hooks/use-arc-inputs.ts components/control/workspace/arc-workspace.tsx pnpm-lock.yaml package.json
git commit -m "feat: extend SurfaceInputs for announcement + pulse; export zones helpers; add qrcode"
```

---

### Task 2: QR code content type, painter, and inspector fields

Adds `qr` as a first-class component type: content model, canvas painter with a per-URL matrix cache, content-meta icon, and inspector form fields.

**Files:**
- Modify: `lib/arc/content.ts`
- Modify: `lib/arc/render/zones.ts`
- Modify: `components/control/workspace/content-meta.tsx`
- Modify: `components/control/zone-content-editor.tsx`
- Test: `lib/arc/content.test.ts`

**Interfaces:**
- Consumes: `fitFont`, `hexA` exported from `zones.ts` (Task 1)
- Produces: `{ type: "qr"; url: string; label: string }` member of `ZoneContent`; `paintQr` painter called by `drawComponent`

- [ ] **Step 1: Write failing tests for `normalizeContent` qr handling**

Add to `lib/arc/content.test.ts`:

```ts
describe("normalizeContent — qr", () => {
  it("returns default label when label is missing", () => {
    const out = normalizeContent({ type: "qr", url: "https://results.example.com" });
    expect(out).toEqual({ type: "qr", url: "https://results.example.com", label: "Scan for results" });
  });

  it("keeps a provided label", () => {
    const out = normalizeContent({ type: "qr", url: "https://x.com", label: "Track your athlete" });
    expect(out).toEqual({ type: "qr", url: "https://x.com", label: "Track your athlete" });
  });

  it("coerces missing url to empty string", () => {
    const out = normalizeContent({ type: "qr" });
    expect(out).toEqual({ type: "qr", url: "", label: "Scan for results" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- lib/arc/content.test.ts
```

Expected: 3 FAIL with "normalizeContent is not a function" or "Expected { type: 'qr' … } but found …" (likely falls through to the `default` branch and returns a text component).

- [ ] **Step 3: Add `qr` to `lib/arc/content.ts`**

In the `ZoneContent` union, add the new member before `| { type: "off" }`:

```ts
| { type: "qr"; url: string; label: string }
```

In `CONTENT_TYPES`, add after the `video` entry:

```ts
{ type: "qr", label: "QR Code" },
```

In `defaultContent`, add before the `off` case:

```ts
case "qr":
  return { type: "qr", url: "", label: "Scan for results" };
```

In `normalizeContent`, add before the `default` case:

```ts
case "qr":
  return {
    type: "qr",
    url: typeof c.url === "string" ? c.url : "",
    label: typeof c.label === "string" && c.label.length > 0 ? c.label : "Scan for results",
  };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- lib/arc/content.test.ts
```

Expected: all existing tests + 3 new ones PASS.

- [ ] **Step 5: Add `paintQr` to `lib/arc/render/zones.ts`**

At the top of the file, add the import after existing imports:

```ts
import QRCode from "qrcode";
```

Add a module-level cache Map just below the imports (before `const FONT = …`):

```ts
/** Per-URL QR module cache so matrix generation runs once per distinct URL. */
const qrCache = new Map<string, { data: Uint8Array; size: number }>();

function getQrMatrix(url: string): { data: Uint8Array; size: number } {
  let cached = qrCache.get(url);
  if (!cached) {
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    cached = { data: qr.modules.data, size: qr.modules.size };
    qrCache.set(url, cached);
  }
  return cached;
}
```

In the `switch (content.type)` block inside `drawComponent`, add a case before `case "color"`:

```ts
case "qr":
  paintQr(ctx, w, h, content);
  break;
```

Add the `paintQr` painter function in the painters section (after `paintText`, before `drawSponsorLogo`):

```ts
const LABEL_H_FRAC = 0.22;

function paintQr(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: Extract<ZoneContent, { type: "qr" }>,
): void {
  if (!content.url) return placeholder(ctx, 8, 8, w - 16, h - 16, "QR CODE");

  const { data, size } = getQrMatrix(content.url);
  const qrAreaH = h * (1 - LABEL_H_FRAC);
  const cellPx = Math.max(1, Math.floor(Math.min(w, qrAreaH) / size));
  const gridPx = cellPx * size;
  const ox = Math.floor((w - gridPx) / 2);
  const oy = Math.floor((qrAreaH - gridPx) / 2);

  ctx.fillStyle = "#0a0a0a";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) {
        ctx.fillRect(ox + col * cellPx, oy + row * cellPx, cellPx, cellPx);
      }
    }
  }

  // Label centered in the bottom LABEL_H_FRAC band
  const labelY = qrAreaH + (h * LABEL_H_FRAC) / 2;
  const labelPx = fitFont(ctx, content.label, w * 0.9, h * LABEL_H_FRAC * 0.55, "500");
  ctx.font = `500 ${labelPx}px ${FONT}`;
  ctx.fillStyle = "#52525b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(content.label, w / 2, labelY);
}
```

- [ ] **Step 6: Add `qr` to `components/control/workspace/content-meta.tsx`**

Add the import for `QrCode`:

```ts
import {
  Broadcast,
  CircleDashed,
  type Icon,
  Image as ImageIcon,
  Images,
  PaintBucket,
  QrCode,           // ← add this
  TextT,
  Timer,
  VideoCamera,
} from "@phosphor-icons/react";
```

Add the entry to `CONTENT_META`:

```ts
qr: { label: "QR Code", Icon: QrCode, dot: "bg-foreground" },
```

- [ ] **Step 7: Add `QrFields` to `components/control/zone-content-editor.tsx`**

The file uses a raw `<input>` pattern. Add the case and subcomponent:

In `ZoneFields`, add a new `case "qr"` before the closing brace:

```tsx
case "qr":
  return <QrFields content={content} onChange={onChange} />;
```

Add the `QrFields` function after the `TextFields` function:

```tsx
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
```

- [ ] **Step 8: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/arc/content.ts lib/arc/content.test.ts lib/arc/render/zones.ts components/control/workspace/content-meta.tsx components/control/zone-content-editor.tsx
git commit -m "feat(qr): add QR code component type with canvas painter and inspector fields"
```

---

### Task 3: Background pulse

Tracks when the newest feed entry changes and draws a faint split-coloured wash behind all components for 2 seconds.

**Files:**
- Create: `hooks/use-last-arrival.ts`
- Modify: `lib/arc/render/compositor.ts`
- Modify: `hooks/use-arc-inputs.ts`
- Modify: `components/control/workspace/arc-workspace.tsx`

**Interfaces:**
- Consumes: `SPLIT_COLOR`, `hexA` exported from `zones.ts` (Task 1); `SurfaceInputs.feed.lastArrivalMs` and `lastArrivalSplit` (Task 1)
- Produces: `useLastArrival(entries)` hook; background pulse rendered in `drawSurface`

- [ ] **Step 1: Create `hooks/use-last-arrival.ts`**

```ts
"use client";

import { useRef } from "react";

import type { FeedEntry } from "@/lib/feed/types";
import type { Split } from "@/lib/feed/types";

/**
 * Tracks the performance.now() timestamp and split of the most recent new entry
 * in the feed. Used to drive the background pulse in the compositor.
 *
 * Updates happen synchronously during render via refs — no state, no re-renders.
 */
export function useLastArrival(entries: FeedEntry[]): {
  lastArrivalMs: number;
  lastArrivalSplit: Split | null;
} {
  const prevIdRef = useRef<string | null>(null);
  const msRef = useRef<number>(0);
  const splitRef = useRef<Split | null>(null);

  const newest = entries[0] ?? null;
  if (newest && newest.id !== prevIdRef.current) {
    prevIdRef.current = newest.id;
    msRef.current = typeof performance !== "undefined" ? performance.now() : 0;
    splitRef.current = newest.split;
  }

  return { lastArrivalMs: msRef.current, lastArrivalSplit: splitRef.current };
}
```

- [ ] **Step 2: Wire `useLastArrival` into `hooks/use-arc-inputs.ts`**

Add import:

```ts
import { useLastArrival } from "./use-last-arrival";
```

Call the hook (after the existing hook calls):

```ts
  const { lastArrivalMs, lastArrivalSplit } = useLastArrival(entries);
```

Update the `useMemo` to use the real values instead of the placeholders from Task 1:

```ts
  return useMemo<SurfaceInputs>(
    () => ({
      config,
      feed: { entries, status, lastArrivalMs, lastArrivalSplit },
      clock: { ms: elapsed, running },
      announcement: null,
    }),
    [config, entries, status, lastArrivalMs, lastArrivalSplit, elapsed, running],
  );
```

- [ ] **Step 3: Wire `useLastArrival` into `components/control/workspace/arc-workspace.tsx`**

Add import:

```ts
import { useLastArrival } from "@/hooks/use-last-arrival";
```

Add the hook call after the existing `useFeed` call (keeping it close to where `entries` is declared):

```ts
  const { lastArrivalMs, lastArrivalSplit } = useLastArrival(entries);
```

Update the `inputs` object (replacing the Task 1 placeholder):

```ts
  const inputs: SurfaceInputs = {
    config,
    feed: { entries, status, lastArrivalMs, lastArrivalSplit },
    clock: { ms: elapsed, running },
    announcement: null,
  };
```

- [ ] **Step 4: Add pulse wash to `lib/arc/render/compositor.ts`**

Add imports at the top:

```ts
import { SPLIT_COLOR, hexA } from "./zones";
```

In `drawSurface`, directly after the background `ctx.fillRect` call and before the component loop, add:

```ts
  // Background pulse: faint split-coloured wash that decays over 2 s when a new athlete arrives.
  const PULSE_MS = 2000;
  if (inputs.feed.lastArrivalMs > 0 && inputs.feed.lastArrivalSplit) {
    const pulseFade = Math.max(0, 1 - (tMs - inputs.feed.lastArrivalMs) / PULSE_MS);
    if (pulseFade > 0) {
      ctx.fillStyle = hexA(SPLIT_COLOR[inputs.feed.lastArrivalSplit], 0.09 * pulseFade);
      ctx.fillRect(0, 0, surface.w, surface.h);
    }
  }
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-last-arrival.ts hooks/use-arc-inputs.ts components/control/workspace/arc-workspace.tsx lib/arc/render/compositor.ts
git commit -m "feat(pulse): background split-colour wash on new athlete arrival"
```

---

### Task 4: Announcement hook and compositor overlay

Persists and broadcasts announcement records via localStorage, and renders the full-surface deep-navy overlay in the compositor.

**Files:**
- Create: `hooks/use-announcement.ts`
- Modify: `lib/arc/render/compositor.ts`
- Modify: `hooks/use-arc-inputs.ts`
- Modify: `components/control/workspace/arc-workspace.tsx`

**Interfaces:**
- Consumes: `AnnouncementRecord` from `lib/arc/render/inputs.ts` (Task 1); `fitFont` exported from `zones.ts` (Task 1)
- Produces: `useAnnouncement()` hook; `paintAnnouncement` layer in `drawSurface`

- [ ] **Step 1: Create `hooks/use-announcement.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

import type { AnnouncementRecord } from "@/lib/arc/render/inputs";

const STORAGE_KEY = "lion-central.arc.announcement";

function readRecord(): AnnouncementRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as AnnouncementRecord;
    if (Date.now() > rec.endsAt) return null;
    return rec;
  } catch {
    return null;
  }
}

export function useAnnouncement(): {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number) => void;
  cancel: () => void;
} {
  const [announcement, setAnnouncement] = useState<AnnouncementRecord | null>(null);

  // Load from localStorage on mount + listen for cross-tab changes.
  useEffect(() => {
    setAnnouncement(readRecord());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setAnnouncement(readRecord());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Auto-expire: clear local state when endsAt passes.
  useEffect(() => {
    if (!announcement) return;
    const remaining = announcement.endsAt - Date.now();
    if (remaining <= 0) { setAnnouncement(null); return; }
    const id = setTimeout(() => setAnnouncement(null), remaining);
    return () => clearTimeout(id);
  }, [announcement]);

  const send = useCallback((text: string, subtitle: string | undefined, durationMs: number) => {
    const rec: AnnouncementRecord = {
      text,
      subtitle: subtitle?.trim() || undefined,
      startedAt: Date.now(),
      endsAt: Date.now() + durationMs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    setAnnouncement(rec);
  }, []);

  const cancel = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAnnouncement(null);
  }, []);

  return { announcement, send, cancel };
}
```

- [ ] **Step 2: Wire `useAnnouncement` into `hooks/use-arc-inputs.ts`**

Add import:

```ts
import { useAnnouncement } from "./use-announcement";
```

Call the hook (after existing hook calls):

```ts
  const { announcement } = useAnnouncement();
```

Update the `useMemo` to replace the `announcement: null` placeholder with the live value:

```ts
  return useMemo<SurfaceInputs>(
    () => ({
      config,
      feed: { entries, status, lastArrivalMs, lastArrivalSplit },
      clock: { ms: elapsed, running },
      announcement,
    }),
    [config, entries, status, lastArrivalMs, lastArrivalSplit, elapsed, running, announcement],
  );
```

- [ ] **Step 3: Wire `useAnnouncement` into `components/control/workspace/arc-workspace.tsx`**

Add import:

```ts
import { useAnnouncement } from "@/hooks/use-announcement";
```

Add the hook call (after existing hook calls):

```ts
  const { announcement, send: sendAnnouncement, cancel: cancelAnnouncement } = useAnnouncement();
```

Update the `inputs` object to replace the `announcement: null` placeholder:

```ts
  const inputs: SurfaceInputs = {
    config,
    feed: { entries, status, lastArrivalMs, lastArrivalSplit },
    clock: { ms: elapsed, running },
    announcement,
  };
```

The `sendAnnouncement` and `cancelAnnouncement` will be passed to `TopToolbar` in Task 5. For now, leave them declared (TypeScript won't error on unused variables in this context).

- [ ] **Step 4: Add `paintAnnouncement` to `lib/arc/render/compositor.ts`**

Add import at the top of the file (merge with the `./zones` import already added in Task 3 — the two lines should become one):

```ts
import type { AnnouncementRecord } from "./inputs";
import { SPLIT_COLOR, hexA, fitFont } from "./zones";
```

Add the `paintAnnouncement` function to `compositor.ts`:

```ts
const ANN_FONT = "Inter, system-ui, sans-serif";

function paintAnnouncement(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rec: AnnouncementRecord,
): void {
  const now = Date.now();
  const fadeIn  = Math.min(1, (now - rec.startedAt) / 200);
  const fadeOut = Math.min(1, (rec.endsAt - now) / 400);
  const alpha   = Math.min(fadeIn, fadeOut);
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);

  const hasSub = !!rec.subtitle?.trim();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const titlePx = fitFont(ctx, rec.text, w * 0.88, hasSub ? h * 0.44 : h * 0.56, "800");
  ctx.font = `800 ${titlePx}px ${ANN_FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(rec.text, w / 2, hasSub ? h * 0.42 : h / 2);

  if (hasSub) {
    const subPx = fitFont(ctx, rec.subtitle!, w * 0.82, h * 0.22, "500");
    ctx.font = `500 ${subPx}px ${ANN_FONT}`;
    ctx.fillStyle = hexA("#ffffff", 0.6);
    ctx.fillText(rec.subtitle!, w / 2, h * 0.72);
  }

  ctx.restore();
}
```

In `drawSurface`, add the call as the final operation after the component loop:

```ts
  // Announcement overlay — drawn last so it covers all components.
  if (inputs.announcement) {
    paintAnnouncement(ctx, surface.w, surface.h, inputs.announcement);
  }
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-announcement.ts hooks/use-arc-inputs.ts components/control/workspace/arc-workspace.tsx lib/arc/render/compositor.ts
git commit -m "feat(announcement): hook + compositor overlay layer"
```

---

### Task 5: Announcement toolbar button and popover

Adds the `AnnouncementButton` component and wires it into `TopToolbar` so the operator can send and cancel announcements from the control workspace.

**Files:**
- Create: `components/control/workspace/announcement-button.tsx`
- Modify: `components/control/workspace/top-toolbar.tsx`
- Modify: `components/control/workspace/arc-workspace.tsx`

**Interfaces:**
- Consumes: `useAnnouncement` return type — `announcement`, `send`, `cancel` (Task 4); `AnnouncementRecord` from `inputs.ts`
- Produces: `<AnnouncementButton>` component; `TopToolbar` extended with `announcementControls` prop

- [ ] **Step 1: Create `components/control/workspace/announcement-button.tsx`**

```tsx
"use client";

import { Megaphone } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AnnouncementRecord } from "@/lib/arc/render/inputs";
import { cn } from "@/lib/utils";

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const labelCls = "text-xs font-medium text-muted-foreground";

const DURATIONS = [
  { label: "15s", ms: 15_000 },
  { label: "30s", ms: 30_000 },
  { label: "1 min", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
];

export function AnnouncementButton({
  announcement,
  send,
  cancel,
}: {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number) => void;
  cancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [durationMs, setDurationMs] = useState(30_000);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer when an announcement is active
  useEffect(() => {
    if (!announcement) { setRemaining(null); return; }
    const tick = () => setRemaining(Math.max(0, announcement.endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [announcement]);

  // Auto-focus the text input when the popover opens in idle state
  useEffect(() => {
    if (open && !announcement) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, announcement]);

  function handleSend() {
    if (!text.trim()) return;
    send(text.trim(), subtitle.trim() || undefined, durationMs);
    setText("");
    setSubtitle("");
    setDurationMs(30_000);
    setOpen(false);
  }

  const isActive = !!announcement;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Send announcement"
            className={cn("relative", isActive && "text-destructive")}
          >
            <Megaphone weight={isActive ? "fill" : "bold"} />
            {isActive && (
              <span className="absolute right-0.5 top-0.5 size-2 animate-pulse rounded-full bg-destructive" />
            )}
          </Button>
        }
      />

      <PopoverContent className="w-72" align="end">
        {isActive ? (
          <ActiveState
            announcement={announcement}
            remaining={remaining}
            onCancel={() => { cancel(); setOpen(false); }}
          />
        ) : (
          <IdleState
            text={text}
            subtitle={subtitle}
            durationMs={durationMs}
            inputRef={inputRef}
            onText={setText}
            onSubtitle={setSubtitle}
            onDuration={setDurationMs}
            onSend={handleSend}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function IdleState({
  text,
  subtitle,
  durationMs,
  inputRef,
  onText,
  onSubtitle,
  onDuration,
  onSend,
}: {
  text: string;
  subtitle: string;
  durationMs: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onText: (v: string) => void;
  onSubtitle: (v: string) => void;
  onDuration: (ms: number) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">Send announcement</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Overrides all surfaces for the selected duration.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Message</label>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Course ahead is clear"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Subtitle (optional)</label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => onSubtitle(e.target.value)}
          placeholder="Next aid station in 2 km"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Duration</label>
        <div className="flex gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.ms}
              type="button"
              onClick={() => onDuration(d.ms)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                durationMs === d.ms
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onSend} disabled={!text.trim()} size="sm" className="w-full">
        Send
      </Button>
    </div>
  );
}

function ActiveState({
  announcement,
  remaining,
  onCancel,
}: {
  announcement: AnnouncementRecord;
  remaining: number | null;
  onCancel: () => void;
}) {
  const remainingStr =
    remaining === null
      ? ""
      : remaining >= 60_000
        ? `${Math.ceil(remaining / 60_000)}m remaining`
        : `${Math.ceil(remaining / 1_000)}s remaining`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-destructive">Announcement live</h3>
          {remainingStr && (
            <p className="mt-0.5 text-xs text-muted-foreground">{remainingStr}</p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <p className="text-sm font-medium">{announcement.text}</p>
        {announcement.subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{announcement.subtitle}</p>
        )}
      </div>

      <Button variant="destructive" size="sm" onClick={onCancel} className="w-full">
        Cancel announcement
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Update `components/control/workspace/top-toolbar.tsx`**

Add the import:

```ts
import { AnnouncementButton } from "./announcement-button";
import type { AnnouncementRecord } from "@/lib/arc/render/inputs";
```

Add `AnnouncementControls` interface and `announcementControls` prop:

```ts
interface AnnouncementControls {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number) => void;
  cancel: () => void;
}
```

Add `announcementControls: AnnouncementControls` to the `TopToolbar` props destructure and interface.

In the JSX, insert `<AnnouncementButton>` as the first element inside the `ml-auto` div (the `<div className="ml-auto flex items-center gap-2">`), followed by a separator:

```tsx
<div className="ml-auto flex items-center gap-2">
  <AnnouncementButton
    announcement={announcementControls.announcement}
    send={announcementControls.send}
    cancel={announcementControls.cancel}
  />
  <span className="mx-0.5 h-5 w-px bg-border" />
  <TestFeedButton file={feedSettings.file} />
  {/* … rest unchanged … */}
```

- [ ] **Step 3: Wire `announcementControls` in `components/control/workspace/arc-workspace.tsx`**

Pass the announcement controls to `TopToolbar`. The `announcement`, `sendAnnouncement`, and `cancelAnnouncement` values were declared in Task 4, Step 3. Update the `<TopToolbar>` JSX call to add the prop:

```tsx
<TopToolbar
  config={config}
  setBackground={setBackground}
  feedSettings={settings}
  feedStatus={status}
  clock={{ elapsed, running, start, pause, reset }}
  onPublish={publish}
  isDirty={isDirty}
  announcementControls={{
    announcement,
    send: sendAnnouncement,
    cancel: cancelAnnouncement,
  }}
  presets={{
    builtins,
    custom,
    onApply: (c) => { replaceConfig(c); setSelected(null); },
    onSave: (name) => save(name, config),
    onDelete: remove,
  }}
/>
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Final test run**

```bash
pnpm test
```

Expected: all tests pass (the 3 new QR normalizeContent tests + all existing tests).

- [ ] **Step 6: Commit**

```bash
git add components/control/workspace/announcement-button.tsx components/control/workspace/top-toolbar.tsx components/control/workspace/arc-workspace.tsx
git commit -m "feat(announcement): toolbar button and send/cancel popover"
```
