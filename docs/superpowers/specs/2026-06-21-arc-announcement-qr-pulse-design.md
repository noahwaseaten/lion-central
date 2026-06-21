# Arc Display Features: Announcement Overlay, QR Code Component, Background Pulse

**Date:** 2026-06-21  
**Status:** Approved

---

## Overview

Three features that make the arc feel more alive and more useful at race-day:

1. **Announcement overlay** — operator sends a temporary full-surface text burst ("Course ahead is clear") that overrides all outputs for N seconds
2. **QR code component** — a new placeable component type that renders a static QR matrix with a configurable label; athletes' families can grab a results/tracker URL from the arc
3. **Background pulse** — a subtle split-colored wash on the surface background that fires and decays over 2 seconds when a new athlete check-in appears; makes the arc feel alive without perpetual motion

---

## 1. Announcement Overlay

### Data model

- **localStorage key:** `lion-central.arc.announcement`
- **Shape:**
  ```ts
  interface AnnouncementRecord {
    text: string;
    subtitle?: string;
    startedAt: number; // Date.now() ms — used to compute fade-in
    endsAt: number;    // Date.now() ms — used to compute fade-out + expiry
  }
  ```
- Stale records (`Date.now() > endsAt`) are ignored by all readers.
- No background cleanup needed; the hook's `setTimeout` handles clearing local state.

### Type location

`AnnouncementRecord` is defined in **`lib/arc/render/inputs.ts`** (alongside `SurfaceInputs`) and imported by the hook. This avoids `inputs.ts` depending on a hook module.

### Cross-tab delivery

Same mechanism as config sync: `localStorage.setItem` on send/cancel, `window.storage` event on all tabs. Output pages pick it up in under one event loop tick — effectively instant on the LAN.

### Hook: `hooks/use-announcement.ts`

```
export function useAnnouncement(): {
  announcement: AnnouncementRecord | null;
  send(text: string, subtitle: string | undefined, durationMs: number): void;
  cancel(): void;
}
```

- On mount: reads localStorage, discards if expired, sets state
- `storage` event listener: re-reads and re-validates on every cross-tab write
- `useEffect` on `announcement`: schedules a `setTimeout` to null-out state when `endsAt` passes; clears on cleanup to avoid stale timeouts
- `send`: writes record to localStorage and updates local state
- `cancel`: removes key from localStorage and nulls local state

### SurfaceInputs extension (`lib/arc/render/inputs.ts`)

```ts
export interface SurfaceInputs {
  config: ArcConfig;
  feed: {
    entries: FeedEntry[];
    status: ConnectionStatus;
    lastArrivalMs: number;        // NEW — see §3
    lastArrivalSplit: Split | null; // NEW — see §3
  };
  clock: { ms: number; running: boolean };
  announcement: AnnouncementRecord | null; // NEW
}
```

### Compositor rendering (`lib/arc/render/compositor.ts`)

`drawSurface` calls `paintAnnouncement(ctx, surface.w, surface.h, inputs.announcement)` as the final layer, after all component layers.

```ts
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
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Deep navy background — rich and authoritative, not black
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);

  // Title: auto-sized bold white text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const hasSub = !!rec.subtitle?.trim();
  const titlePx = fitFontAnn(ctx, rec.text, w * 0.88, hasSub ? h * 0.44 : h * 0.56);
  ctx.font = `800 ${titlePx}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(rec.text, w / 2, hasSub ? h * 0.42 : h / 2);

  // Subtitle (optional)
  if (hasSub) {
    const subPx = fitFontAnn(ctx, rec.subtitle!, w * 0.82, h * 0.22);
    ctx.font = `500 ${subPx}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(rec.subtitle!, w / 2, h * 0.72);
  }

  ctx.restore();
}
```

`fitFontAnn` mirrors the existing `fitFont` in `zones.ts` (same algorithm). Since `paintAnnouncement` lives in `compositor.ts`, it either imports the helper from `zones.ts` (it should be exported) or duplicates the small function. Prefer exporting from `zones.ts`.

### Control UI: `components/control/workspace/announcement-button.tsx`

- Icon: `Megaphone` from `@phosphor-icons/react`
- Position: first item inside the `ml-auto` group in `TopToolbar`, separated from the rest:
  ```
  [ml-auto] AnnouncementButton | sep | TestFeedButton | FeedStatusChip | sep | Appearance | sep | Publish
  ```
- **Idle state:** ghost icon button, no label
- **Active state:** button tinted amber/destructive, label "Live" (pulsing dot)
- Clicking opens a `Popover`:
  - **When idle:**
    - `<textarea>` (or `<input>`) for announcement text (required, autofocused), placeholder "e.g. Course ahead is clear"
    - Optional subtitle `<input>`, placeholder "e.g. Next aid station in 2 km"
    - Duration row: four quick-pick buttons — **15s · 30s · 1min · 2min** — one selected at a time (default: 30s)
    - `Send` button (disabled when text is empty); closes popover on click
  - **When active:**
    - Shows current message text (read-only)
    - Shows time remaining (update every second via `setInterval`)
    - `Cancel` button; clears immediately

`TopToolbar` receives a new prop `announcement: AnnouncementControls` where:
```ts
interface AnnouncementControls {
  announcement: AnnouncementRecord | null;
  send: (text: string, subtitle: string | undefined, durationMs: number) => void;
  cancel: () => void;
}
```

### Wire-up

- `useAnnouncement()` called in **`ArcWorkspace`** and in **`useArcInputs`**
- Both include `announcement` in the assembled `SurfaceInputs`
- `ArcWorkspace` passes `{ announcement, send, cancel }` to `TopToolbar`

---

## 2. QR Code Component

### Content type (`lib/arc/content.ts`)

New union member:
```ts
| { type: "qr"; url: string; label: string }
```

`defaultContent("qr")`: `{ type: "qr", url: "", label: "Scan for results" }`

`normalizeContent` case:
```ts
case "qr":
  return { type: "qr", url: str(c.url), label: str(c.label, "Scan for results") };
```

`CONTENT_TYPES` addition:
```ts
{ type: "qr", label: "QR Code" }
```

### npm dependency

```
pnpm add qrcode
pnpm add -D @types/qrcode
```

### Painter: `paintQr` in `lib/arc/render/zones.ts`

```
function paintQr(ctx, w, h, content: Extract<ZoneContent, { type: "qr" }>): void
```

- **Empty URL:** calls `placeholder(ctx, 8, 8, w-16, h-16, "QR CODE")` and returns
- **QR generation:**
  - Module matrix: `QRCode.create(url, { errorCorrectionLevel: "M" }).modules`
  - Cache result keyed by URL in a module-level `Map<string, QRModuleData>` so it is only computed once per distinct URL (not per frame)
  - `size` = `matrix.size` (number of modules per side, including quiet zone)
  - Add 4-module quiet zone on each side if not already included (spec requires it; the `qrcode` package includes it by default)
- **Layout:**
  - Reserve bottom `LABEL_H_FRAC = 0.22` of height for label; QR fills the top `1 - LABEL_H_FRAC`
  - `cellPx = Math.floor(Math.min(w, h * (1 - LABEL_H_FRAC)) / matrix.size)`
  - Center the grid: `originX = (w - cellPx * size) / 2`, `originY = (h * (1 - LABEL_H_FRAC) - cellPx * size) / 2`
  - Draw each dark module as a `fillRect(originX + col * cellPx, originY + row * cellPx, cellPx, cellPx)`
  - Fill color: `#0a0a0a` (same as text — reads well on the white arc)
- **Label:**
  - Drawn centered in the bottom `LABEL_H_FRAC * h` region
  - `fitFont`, weight 500, color `#52525b`
  - `ctx.fillText(content.label, w / 2, h * (1 - LABEL_H_FRAC / 2))`

### Content meta (`components/control/workspace/content-meta.tsx`)

```ts
qr: { label: "QR Code", Icon: QrCode, dot: "bg-foreground" },
```

`QrCode` imported from `@phosphor-icons/react`.

### Inspector fields (`components/control/zone-content-editor.tsx`)

Add a `case "qr"` to `ZoneFields`:
```tsx
case "qr":
  return <QrFields content={content} onChange={onChange} />;
```

`QrFields` renders:
- URL text input (`type="url"` or `type="text"`), label "URL", placeholder "https://..."
- Label text input, label "Label", placeholder "Scan for results"

---

## 3. Background Pulse

### Hook: `hooks/use-last-arrival.ts`

```ts
export function useLastArrival(entries: FeedEntry[]): {
  lastArrivalMs: number;
  lastArrivalSplit: Split | null;
}
```

Implementation:
```ts
const prevIdRef = useRef<string | null>(null);
const msRef     = useRef(0);
const splitRef  = useRef<Split | null>(null);

const newestId = entries[0]?.id ?? null;
if (newestId !== null && newestId !== prevIdRef.current) {
  prevIdRef.current = newestId;
  msRef.current     = typeof performance !== "undefined" ? performance.now() : 0;
  splitRef.current  = entries[0].split;
}

return { lastArrivalMs: msRef.current, lastArrivalSplit: splitRef.current };
```

Note: updates are committed synchronously during render (safe in React 19 — refs are escape hatches); no `useEffect` needed.

### SurfaceInputs

Already captured in §1's extension. `feed.lastArrivalMs` and `feed.lastArrivalSplit` are populated by `useLastArrival` in both `useArcInputs` and `ArcWorkspace`.

### Compositor rendering (`lib/arc/render/compositor.ts`)

In `drawSurface`, directly after the background fill and before the component loop:

```ts
const PULSE_MS = 2000;
if (inputs.feed.lastArrivalMs > 0 && inputs.feed.lastArrivalSplit) {
  const pulseFade = Math.max(0, 1 - (tMs - inputs.feed.lastArrivalMs) / PULSE_MS);
  if (pulseFade > 0) {
    const color = SPLIT_COLORS[inputs.feed.lastArrivalSplit];
    ctx.fillStyle = hexAlpha(color, 0.09 * pulseFade);
    ctx.fillRect(0, 0, surface.w, surface.h);
  }
}
```

`SPLIT_COLORS` and `hexAlpha` exported from `zones.ts`. They already exist there as `SPLIT_COLOR` and `hexA` — rename both at declaration and update all internal uses in `zones.ts` at the same time.

---

## Files changed

| File | Change |
|---|---|
| `lib/arc/render/inputs.ts` | Extend `SurfaceInputs.feed` with `lastArrivalMs` + `lastArrivalSplit`; add `announcement` field; import `Split` from feed types |
| `lib/arc/content.ts` | Add `qr` to `ZoneContent` union, `defaultContent`, `normalizeContent`, `CONTENT_TYPES` |
| `lib/arc/render/zones.ts` | Add `paintQr`; export `SPLIT_COLOR` (rename to `SPLIT_COLORS` for clarity) and `hexA` (rename `hexAlpha`) |
| `lib/arc/render/compositor.ts` | Add pulse wash after bg fill; add `paintAnnouncement` call as final layer; import helpers from `zones.ts` |
| `hooks/use-announcement.ts` | New hook |
| `hooks/use-last-arrival.ts` | New hook |
| `hooks/use-arc-inputs.ts` | Call `useAnnouncement` + `useLastArrival`; extend returned `SurfaceInputs` |
| `components/control/workspace/arc-workspace.tsx` | Call `useAnnouncement` + `useLastArrival`; add announcement to inputs; pass controls to `TopToolbar` |
| `components/control/workspace/top-toolbar.tsx` | Add `announcement: AnnouncementControls` prop; render `<AnnouncementButton>` |
| `components/control/workspace/announcement-button.tsx` | New component |
| `components/control/workspace/content-meta.tsx` | Add `qr` entry with `QrCode` icon |
| `components/control/zone-content-editor.tsx` | Add `case "qr"` → `<QrFields>` |

### New npm packages

- `qrcode` (runtime)
- `@types/qrcode` (dev)

---

## Decisions & constraints

- **No black on announcements.** Background is `#0f172a` (deep navy), not `#000000`.
- **Announcement is all-surface.** There is no per-surface targeting; every output shows the same overlay simultaneously. This is intentional — a race director saying "Medical on course" needs every panel covered.
- **QR is a standard component.** It goes on any surface, is placed and sized like any other component, and lives in the normal layer stack. No special treatment.
- **Pulse is behind components.** The wash is painted between the surface background fill and the first component — it never occludes content, just tints the background.
- **QR matrix is cached per-URL.** Computing the matrix is fast (~1ms) but unnecessary every frame; a module-level `Map<string, matrix>` stores it indefinitely (URLs don't change at runtime).
- **`fitFont` exported from `zones.ts`** so `compositor.ts` can use it for announcement text without duplication.
