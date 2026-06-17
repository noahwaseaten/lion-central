# SPEC — Unified Arc Control & Projection App

**Status:** Approved direction (brainstormed 2026-06-16 with the visual companion)
**Supersedes:** `SPEC.md` (the two-surface live-feed/clock draft)
**Feature:** One app that previews and controls the *entire* physical arc — every LED surface — from a single panel.

---

## 1. What changed and why

The first draft split the arc into two separate display pages (`/live`, `/clock`) each
with its own control drawer (hotkeys `S` and `C`). That was the confusion: two
mental models, two panels, duplicated controls, and the arc legs / clock-on-top
weren't modeled at all.

This spec replaces that with **one control app** that:

- Models the **whole arc** as a set of physical **surfaces**, each split into **zones**.
- Renders a **live 3D preview** of the arc (Three.js) you can orbit.
- Drives **every zone** from a single control panel — assign content, set per-zone
  intervals, swap sponsors, play video, etc. ("complete projection control").
- Exposes **per-surface output routes** (`/output/[surface]`) — the clean, full-screen,
  native-resolution render you point each physical LED/projector at.
- Keeps all state in sync across the control tab and every output tab (localStorage
  + `BroadcastChannel` / storage events).

The local timing-file plumbing (parse / split inference / SSE / polling) is **kept
as-is** and reused.

---

## 2. Physical model (confirmed against the event photo)

The arc is an inverted-U archway. **Front and back faces carry LED content; the
top/bottom/inner edges are bare frame (hollow between the legs).** Dimensions are
in native CSS px (1 unit). `ScaleToFit` scales each surface to its screen.

### Surfaces & zones (option B dimensions — locked)

```
                 ┌───────────────┐
                 │  CLOCK 384×96 │              (mounted on top, centered)
   ┌─────────────┴───────────────┴─────────────┐
   │ SHOULDER_L │   BRAND 650×100  │ SHOULDER_R │   TOP BAR 1280×256
   │  315×256   ├──────────────────┤  315×256   │
   │            │  LIVE FEED 650×156│           │
   ├────────────┴──────────────────┴────────────┤
   │ LEG_L                         LEG_R         │
   │ 128×640                       128×640       │   (legs hang from the sides)
   └─────────────                  ──────────────┘
```

| Surface     | Size      | Zones |
|-------------|-----------|-------|
| `clock`     | 384×96    | `clock-main` (full) |
| `topbar`    | 1280×256  | `shoulder-left` 315×256 @(0,0) · `brand` 650×100 @(315,0) · `feed` 650×156 @(315,100) · `shoulder-right` 315×256 @(965,0) |
| `leg-left`  | 128×640   | `leg-left` (full) |
| `leg-right` | 128×640   | `leg-right` (full) |

Math checks: 315 + 650 + 315 = 1280; 100 + 156 = 256.

---

## 3. Zone content system

Every zone is a **slot** that renders one **content** assignment. Content is drawn by
a **canvas compositor** (one shared renderer), so the 3D preview textures and the
flat output routes use the *same* drawing code — and video/image/animation all flow
through one uniform pipeline (the right tool for projection control).

```ts
// lib/arc/content.ts
export type ZoneContent =
  | { type: "feed" }                                   // live athlete feed (SSE data)
  | { type: "clock" }                                  // race clock
  | { type: "text"; title: string; subtitle?: string } // brand / event name
  | { type: "sponsors"; images: string[]; mode: "rotate" | "grid"; intervalMs: number }
  | { type: "image"; src: string; fit: "contain" | "cover" }
  | { type: "video"; src: string; loop: boolean; muted: boolean; fit: "contain" | "cover" }
  | { type: "color"; color: string }
  | { type: "off" };                                   // black / blank
```

`images`/`src` are URLs or data-URIs (operator can paste a URL or upload → data-URI
in localStorage). Per-zone `intervalMs` drives sponsor rotation; other timed
behaviour (e.g. animated feed entrances) is time-driven in the renderer.

### ArcConfig (persisted, cross-tab synced)

```ts
export interface ArcConfig {
  zones: Record<ZoneId, ZoneContent>;   // assignment per zone
  background: string;                    // arc surface background (default white)
}
```

Defaults mirror the photo: shoulders → `sponsors` (rotate), `brand` → `text`
("LION ♦ HEART" / event), `feed` → `feed`, legs → `sponsors` (grid), `clock` → `clock`.

---

## 4. Architecture

```
              ┌──────────────────────── Control app  "/"  ────────────────────────┐
 timing .txt  │  ┌── ArcPreview3D (three.js) ──┐   ┌── ControlPanel (shadcn) ──┐  │
   │  (SSE)   │  │  4 offscreen canvases →      │   │  surface/zone picker      │  │
   ▼          │  │  CanvasTexture on arc mesh   │   │  content editors          │  │
 use-feed ────┼─▶│  orbit, lighting             │   │  feed file/thresholds     │  │
 use-race-clk │  └──────────────────────────────┘   │  clock start/pause/set    │  │
 use-arc-cfg  │                                      │  TEST: append feed line   │  │
              │      shared state (localStorage + BroadcastChannel/storage)        │  │
              └────────────────────────────────────────────────────────────────────┘
                                   │ same state, same compositor
                                   ▼
        /output/clock   /output/topbar   /output/leg-left   /output/leg-right
        (each: visible canvas at native size, ScaleToFit, no controls)
```

- **Compositor** `lib/arc/render/compositor.ts`: `drawSurface(ctx, surfaceId, inputs, tMs)`.
  Pure given `inputs` (config, feed entries+status, clock ms+running). Per-canvas
  animation state (feed row entrances, sponsor rotation phase, video elements) kept
  in a `Map` keyed by the canvas — self-contained, no React coupling.
- **`useSurfaceCanvas(surfaceId, ref, inputs)`**: runs a `requestAnimationFrame` loop
  calling the compositor. Used by both preview (offscreen) and output (visible).
- **3D preview**: builds the arc geometry from `lib/arc/layout.ts`, maps each surface
  canvas as a `CanvasTexture` (front + back faces), `OrbitControls`, soft lighting,
  graceful WebGL-unavailable fallback (flat stacked surfaces).
- **Output routes** `/output/[surface]` (client; `use(params)` per Next 16): one
  `<SurfaceOutput>` = native-size canvas in `ScaleToFit`.
- **Cross-tab sync**: `useArcConfig`, `useFeedSettings`, `useRaceClock` listen to
  `storage` events so an operator change on `/` updates every `/output/*` tab live.

---

## 5. Control panel (one panel, replaces both drawers)

A persistent left rail (shadcn). No hotkey-toggled separate drawers; one place for
everything. Sections:

1. **Surfaces / Zones** — pick a surface, then a zone (also click a zone in the 3D
   preview to select it). Shows the zone's content editor.
2. **Content editor** — type selector + fields per type (text, sponsor list +
   interval + rotate/grid, image url/upload + fit, video url + loop/mute, color, off).
3. **Live feed** — file picker (`/api/feed/files`), split thresholds, polling options,
   connection status (moved from the old setup drawer).
4. **Race clock** — start / pause / reset / set elapsed (moved from clock drawer).
5. **Test tools** — **"Append random athlete"** button → `POST /api/feed/append`
   writes one random `BIB FIRST LAST TIME` line to the selected file so the feed
   animation can be previewed without the timing backend. Also "Open output →" links.
6. **Status** — offline banner (internet vs. feed clarified), feed connection pill.

Every control has hover / focus / disabled / loading / error states (shadcn defaults
+ explicit handling), per the project design rules.

---

## 6. Server additions

- **`POST /api/feed/append?file=<name>`** (new) — appends one random valid athlete
  line to a `.txt` inside `FEED_DIR` (path-guarded via `safeResolve`). Used by the
  Test button. `404` when `FEED_DIR` unset; `400` on bad/missing file. Local-only,
  same guard rules as the read routes.
- Existing `files` / `stream` / `tail` routes unchanged.

`FEED_ROWS` stays 3.

---

## 7. File structure (new / changed)

```
app/
  page.tsx                      # REPLACES scaffold → Arc Control (client)
  output/[surface]/page.tsx     # per-surface clean output (client, use(params))
  live/page.tsx                 # REMOVED (folded into control + output)
  clock/page.tsx                # REMOVED (clock is a surface/zone now)
  api/feed/append/route.ts      # NEW — append random line

components/arc/
  arc-preview-3d.tsx            # three.js orbitable arc, canvas-textured faces
  surface-output.tsx            # native-size canvas in ScaleToFit (output)
  scale-to-fit.tsx              # kept
  (top-bar-stage.tsx, sponsor-slot.tsx — removed/absorbed)
components/control/
  control-panel.tsx             # the single left-rail panel
  zone-content-editor.tsx       # per-zone content fields
  feed-settings-section.tsx     # file/thresholds/polling/status
  clock-section.tsx             # start/pause/reset/set
  test-tools-section.tsx        # append-random button + output links
  offline-banner.tsx
components/live/                # split-badge kept (used by canvas? no) — feed render moves to canvas

hooks/
  use-arc-config.ts             # NEW — ArcConfig persisted + cross-tab synced
  use-surface-canvas.ts         # NEW — rAF compositor loop
  use-feed.ts / use-feed-settings.ts / use-race-clock.ts / use-online-status.ts  # kept (+ storage sync)

lib/arc/
  layout.ts                     # UPDATED dims + surface/zone geometry
  surfaces.ts                   # NEW — Surface/Zone descriptors, SURFACES[], zone rects
  content.ts                    # NEW — ZoneContent, ArcConfig, defaults
  render/
    compositor.ts               # NEW — drawSurface()
    zones.ts                    # NEW — drawZone() dispatch + per-type painters
    feed-anim.ts                # NEW — feed entrance animation state
lib/feed/                       # kept as-is (parse/splits/format/tail/types/tests)
```

> Surfaces are **rendered display output** (canvas), not app UI — so canvas drawing
> here is a deliberate, documented exception to "shadcn/Tailwind only", which still
> governs the control panel and all operator UI.

---

## 8. Non-negotiables carried over

- Consistent tokens/spacing/variants across the control UI (shadcn base).
- Offline-first: feed is local; offline banner clarifies internet ≠ feed; network
  actions (image/video URL fetches) degrade gracefully.
- Every interactive element: hover / focus / loading / error states.
- Local-only: `/output/*` and `/api/feed/*` disabled (404) when `FEED_DIR` unset.
- TypeScript strict, named exports (pages excepted), components small & focused.

---

## 9. Build sequence

1. `lib/arc/layout.ts` + `surfaces.ts` + `content.ts` (geometry, descriptors, defaults).
2. `lib/arc/render/*` compositor + zone painters + feed animation (canvas).
3. `hooks/use-arc-config.ts`, `use-surface-canvas.ts`; add storage-sync to existing hooks.
4. `app/api/feed/append/route.ts` + `lib/feed/tail.ts` append helper.
5. `components/arc/surface-output.tsx` + `app/output/[surface]/page.tsx`.
6. `components/arc/arc-preview-3d.tsx` (three.js).
7. `components/control/*` panel + sections; `app/page.tsx` control app.
8. Remove `/live`, `/clock`, obsolete components.
9. `pnpm lint` + `pnpm typecheck` + `pnpm build`; manual smoke via Test button.
10. Update `AGENTS.md` / `CLAUDE.md`.

---

## 10. Out of scope (later)

Real hardware/network transport to the arc controller, the separate central stage
screen (different part of the event), multi-image asset library/CDN, auth.
Sponsor/image assets are operator-provided URLs or uploads for now.
