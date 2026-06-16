# SPEC — Live Feed Display (Arc Top Bar)

**Status:** Draft for approval
**Date:** 2026-06-16
**Feature:** Live Feed Display + Race Clock — the first feature set of the Lion Central arc app.
**Scope:** This spec covers the live feed display, the race-clock counter, and their local data plumbing. The Arc Control panel (and sponsor-logo *management*) is a separate, later feature.

---

## 1. Overview

Two local-only display surfaces for the arc:

1. **Top-bar stage (1280×256)** — the arc's top bar, rendered as a *composition*: the live feed occupies the **bottom-center**, leaving **sponsor shoulders** (left/right) and a **top strip** as sponsor/branding space.
2. **Race-clock counter (320×64)** — a small separate bar (a quarter of the top bar in each dimension) showing the running race clock.

The live feed reads a plain `feed.txt` produced **locally by the custom timing backend**, shows the **3 most recent athletes** (newest on top), infers each athlete's current split (Swim / Bike / Run) from their cumulative race time, and animates new arrivals with a flip-board motion. Sponsor zones render placeholder slots for now (logo *management* arrives with Arc Control).

### Locked design decisions

| Decision | Choice |
|---|---|
| Layout | Stacked rows, newest on top and highlighted |
| Background | **White** (the arc is a physical white structure) |
| Typography | **Inter**, editorial-minimal treatment, hairline split accent, tabular numerals |
| Split colors | Swim `#0284c7`, Bike `#ea580c`, Run `#059669` (tuned for white) |
| Per-split icon | Yes — Phosphor icons (swim / bike / run) |
| Entrance/exit motion | **Flip board** (rotateX flip from top edge), rows shift via layout animation |
| Animation library | **Framer Motion** only |
| Newest emphasis | Highlighted top row (split-tinted background, slightly larger) |
| Split source | **Inferred** from cumulative TIME vs operator-configured thresholds + grace |
| TIME meaning | Cumulative race time since gun start |
| Thresholds | Global, operator-editable (sensible defaults), live-adjustable |
| File source | **Directory-scoped picker** — base folder via env var, app lists `.txt`, operator selects |
| Live updates | **SSE push** (server `fs.watch`) with **configurable polling fallback** |
| File read direction | New lines appended at file bottom (newest = last line); reversed for display |
| Controls placement | **Separate setup drawer** (gear / hotkey); `/live` renders only the clean stage |
| Canvas fit | **Auto-scale to fit** — design at exact native size, uniform CSS scale, centered/letterboxed |
| Top-bar composition | Live feed in **bottom-center**; **sponsor shoulders** (L/R) + **top strip** around it |
| Sponsor zones | Placeholder slots now; populated by Arc Control later |
| Race clock | Separate **320×64** surface (`/clock`), operator-driven race clock (start/pause/reset) |
| Feed source | `feed.txt` written **locally by the custom timing backend** into `FEED_DIR` |

---

## 2. Architecture

```
Custom timing backend ──appends──▶ feed.txt (local disk, inside FEED_DIR)
                                  │
                          fs.watch (Node runtime)
                                  │
   Browser ◀── SSE stream ── app/api/feed/stream  (push: last-3 snapshot on change)
          ◀── JSON poll ──── app/api/feed/tail    (fallback when SSE drops)
          ◀── JSON list ──── app/api/feed/files   (directory-scoped picker)
                                  │
                         useFeed() hook (client)
                                  │
        TopBarStage ── LiveFeedBar → FeedRow × 3 (Framer Motion)
                    └─ SponsorSlot × 3 (top strip + L/R shoulders)

  /clock  ──  useRaceClock() (localStorage) ── RaceClock (320×64)
```

The race clock is independent of the feed: it counts from an operator-set start timestamp (persisted), so it needs no backend and keeps ticking across refreshes.

**Key property — offline-first by construction:** the entire data path is local (browser ↔ local Next server ↔ local file). Internet loss does **not** stop the feed. The only "connection" that matters is the browser↔local-server SSE channel; remote assets (fonts) are self-hosted via `next/font` so nothing on the display depends on the internet. The offline banner (per design rules) reflects internet status but explicitly reassures that the feed remains live.

### Runtime notes (Next.js 16, verified against bundled docs)

- Route Handlers (`app/api/.../route.ts`) support streamed `Response` bodies → used for SSE.
- They run on the **Node runtime** by default → `fs` / `fs.watch` available.
- GET handlers that do async filesystem reads are dynamic (not cached) automatically; we also set `export const dynamic = 'force-dynamic'` defensively on feed routes.

---

## 3. File Structure

```
app/
  live/
    page.tsx                # /live — top-bar stage (client). ScaleToFit > TopBarStage + SetupDrawer
  clock/
    page.tsx                # /clock — race-clock surface (client). ScaleToFit > RaceClock + ClockControls
  api/
    feed/
      files/route.ts        # GET → list .txt files in FEED_DIR
      stream/route.ts       # GET ?file= → SSE; pushes last-3 snapshot on change
      tail/route.ts         # GET ?file= → JSON last-3 snapshot (polling fallback)

components/
  arc/
    scale-to-fit.tsx        # generic: measures viewport, uniform-scales a fixed design surface
    top-bar-stage.tsx       # composes 1280×256: top strip + L/R shoulders + bottom-center feed
    sponsor-slot.tsx        # placeholder sponsor zone (named, sized; Arc Control fills later)
  live/
    live-feed-bar.tsx       # the feed sub-region; owns visual states (loading/empty/error/offline/live)
    feed-row.tsx            # one athlete row + flip variants + newest emphasis
    split-badge.tsx         # split icon + label chip, colored per split
    setup-drawer.tsx        # gear/hotkey panel: file picker, thresholds, polling, status
    feed-state-overlays.tsx # skeleton / empty / error / reconnecting visuals for the bar
  clock/
    race-clock.tsx          # the 320×64 counter surface
    clock-controls.tsx      # gear/hotkey drawer: start / pause / reset / set start, fullscreen
  ui/                       # shadcn primitives (existing)

hooks/
  use-feed.ts               # SSE + polling fallback orchestration → { entries, status }
  use-online-status.ts      # navigator.onLine + online/offline events
  use-feed-settings.ts      # localStorage-backed settings (file, thresholds, polling)
  use-race-clock.ts         # localStorage-backed race clock (startedAt, paused, elapsed)

lib/
  arc/
    layout.ts               # top-bar layout constants (strip/shoulder/feed regions) + clock dims
  feed/
    types.ts                # Split, FeedEntry, FeedSnapshot, ConnectionStatus, SplitThresholds
    parse.ts                # parseLine(raw) → FeedEntry | null
    splits.ts               # inferSplit(seconds, thresholds), DEFAULT_THRESHOLDS
    format.ts               # formatTime, splitLabel, splitMeta (color token, icon, label)
    tail.ts                 # server-only: readLastLines, listTxtFiles, safeResolve (path guard)
    parse.test.ts, splits.test.ts, tail.test.ts   # Vitest unit tests
  utils.ts                  # existing cn()

SPEC.md
vitest.config.ts
.env.local                  # FEED_DIR=... (not committed)
```

> Naming: kebab-case files, **named exports** only (pages are the sole default-export exception), per project Code Style.

---

## 3A. Stage Layout & Dimensions

All dimensions live in `lib/arc/layout.ts` as named constants so they are tunable in one place.

### Top-bar stage (1280×256)

```
┌──────────────────────────────────────────────────────────┐  ← TOP_STRIP (1280×44)  sponsor/brand
├───────────────┬──────────────────────────┬───────────────┤
│  SHOULDER_L   │        LIVE FEED          │  SHOULDER_R   │
│   260×212     │        760×212            │    260×212    │  ← lower band (212)
│  (sponsor)    │   (3 stacked rows)        │  (sponsor)    │
└───────────────┴──────────────────────────┴───────────────┘
        260      +          760           +       260        = 1280
```

```ts
export const TOP_BAR = { w: 1280, h: 256 } as const;
export const TOP_STRIP_H = 44;          // top sponsor/brand strip, full width
export const SHOULDER_W = 260;          // each sponsor shoulder
export const FEED = {                    // bottom-center live-feed region
  w: TOP_BAR.w - SHOULDER_W * 2,        // 760
  h: TOP_BAR.h - TOP_STRIP_H,           // 212
  x: SHOULDER_W,                         // 260
  y: TOP_STRIP_H,                        // 44
} as const;
export const CLOCK = { w: 320, h: 64 } as const;  // race-clock surface (¼ of top bar each axis)
```

- The **feed region (760×212)** holds the 3 stacked rows (~70px each). The previously-designed minimal row layout scales down cleanly into this region.
- **Sponsor slots** (`SponsorSlot`) render a neutral placeholder (dashed outline + label e.g. "SPONSOR") with a stable `name`/`slotId`, sized to their region. Arc Control will later inject logos; the slot API is intentionally simple now.
- Each surface is wrapped by `ScaleToFit` independently, so `/live` and `/clock` can run on separate physical screens at their own scales.

---

## 4. Data Model

```ts
// lib/feed/types.ts
export type Split = "swim" | "bike" | "run";

export interface FeedEntry {
  id: string;        // stable key for animation: `${bib}-${timeRaw}`
  bib: string;
  first: string;
  last: string;
  name: string;      // "FIRST LAST" (display-cased)
  timeRaw: string;   // original TIME token, e.g. "01:18:50"
  seconds: number;   // parsed cumulative seconds
  split: Split;      // inferred
}

export interface FeedSnapshot {
  entries: FeedEntry[];   // newest-first, length 0..3
  fileMtimeMs: number;
}

export type ConnectionStatus =
  | "connecting"   // opening SSE
  | "live"         // SSE open, receiving
  | "reconnecting" // SSE dropped, retrying
  | "polling"      // fallback active
  | "empty"        // connected, file has no valid athletes yet
  | "error"        // file missing / unreadable / no file selected
  | "offline";     // browser reports no network (informational; feed still local)

export interface SplitThresholds {
  swimEndSec: number;  // cumulative time at which swim → bike
  bikeEndSec: number;  // cumulative time at which bike → run
  graceSec: number;    // boundary buffer to avoid premature split bumps
}
```

### Parsing (`parse.ts`)

- Line format: `BIB FIRSTNAME LASTNAME TIME`, whitespace-delimited, tolerant of repeated spaces.
- Strategy: split on whitespace; **first token = BIB**, **last token = TIME**, **middle tokens = name** (join; supports multi-word names). Requires ≥3 tokens, else `null`.
- TIME accepts `HH:MM:SS`, `H:MM:SS`, or `MM:SS` → seconds. Unparseable → `null` (line skipped, never crashes the feed).
- Partial trailing line (file mid-write, no newline): tolerated — parse what's present; corrected on next event.
- `name` display-casing: stored uppercase tokens are title-cased for the chosen minimal treatment (configurable in `format.ts`).

### Split inference (`splits.ts`)

Stateless, from cumulative seconds + thresholds:

```
swim  if seconds <  swimEndSec + graceSec
bike  if seconds <  bikeEndSec + graceSec
run   otherwise
```

The grace buffer keeps an athlete in the prior split briefly past a boundary so a crossing right at the line isn't misclassified.

**Default thresholds (placeholders — operator MUST tune per event in the drawer):**
`swimEndSec = 2700` (45:00), `bikeEndSec = 12600` (3:30:00), `graceSec = 120` (2:00).

---

## 5. Server: Route Handlers

All feed routes: `export const dynamic = "force-dynamic"`, Node runtime, and use `safeResolve()` to confine access within `FEED_DIR` (reject `..`, absolute escapes, symlink escapes).

- **`GET /api/feed/files`** → `{ files: { name, mtimeMs }[] }`, sorted by mtime desc. `404` if `FEED_DIR` is unset (feature treated as disabled — see §11); `500` if it is set but unreadable.
- **`GET /api/feed/stream?file=<name>`** → `text/event-stream`:
  - Validates `file` within `FEED_DIR`; 400 if invalid.
  - On open: read tail, send `event: snapshot` with parsed last-3 (newest-first).
  - `fs.watch` (debounced ~80ms) the file → re-read tail → send fresh `snapshot`.
  - Heartbeat comment (`: ping`) every 15s so the client can detect a dead channel.
  - On file deletion/read error: send `event: error`.
  - Clean up watcher + timers on stream cancel (client disconnect).
  - Snapshots are **idempotent full state** (always the current last 3), so reconnects and missed events self-heal.
- **`GET /api/feed/tail?file=<name>`** → `{ snapshot }` JSON; identical parsing to the stream. Used by the polling fallback.

**Tail read (`tail.ts`)** reads only the file's end (read last ~8KB, split lines, take last 3 non-empty), so it stays cheap on large files.

---

## 6. Client State Management

No global store. State lives in three hooks:

- **`use-feed-settings.ts`** — `{ file, thresholds, pollingMs, useFallbackAlways }`, persisted to `localStorage` (key `lion-central.live`). Defaults from `DEFAULT_THRESHOLDS`, `pollingMs = 1500`.
- **`use-online-status.ts`** — `navigator.onLine` + `online`/`offline` events → boolean. Informational only.
- **`use-feed.ts`** — the orchestrator. Inputs: `file`, `thresholds`, `pollingMs`. Output: `{ entries, status }`.
  - Opens `EventSource(/api/feed/stream?file=)`. On `snapshot`, re-infer split with **current** thresholds (so live threshold edits re-color instantly) and set `entries`.
  - On SSE `error`/close → status `reconnecting`, exponential backoff retry; after N failures, switch to **polling** `/api/feed/tail` at `pollingMs`.
  - When SSE recovers, stop polling.
  - `useFallbackAlways` forces polling mode (for known-flaky setups).
  - Derives `status` (`connecting`/`live`/`polling`/`reconnecting`/`empty`/`error`/`offline`).

> Split is re-inferred **client-side** from `seconds`, so changing thresholds in the drawer recolors the visible rows immediately without a server round-trip.

---

## 7. Components & Animation

### `ScaleToFit`
Generic wrapper around a fixed design surface of given `width`/`height`. Measures the viewport (`ResizeObserver`), computes `scale = min(vw/width, vh/height)`, applies `transform: scale()` centered, white letterbox. Used by both `/live` (1280×256) and `/clock` (320×64). Fullscreen button (Fullscreen API) lives in each surface's drawer.

### `TopBarStage`
Composes the 1280×256 surface from `lib/arc/layout.ts` regions: a full-width `SponsorSlot` top strip, left/right `SponsorSlot` shoulders, and the `LiveFeedBar` in the bottom-center feed region (760×212). Pure layout; passes feed props through.

### `SponsorSlot`
Placeholder sponsor zone — neutral dashed outline + centered label, sized to its region, with a stable `slotId`/`name`. No logo logic yet (Arc Control owns that later).

### `LiveFeedBar`
The feed sub-region surface. Picks the visual state from `status` + `entries`:

| State | Visual |
|---|---|
| `connecting` | 3 skeleton rows (subtle pulse via `tw-animate-css`) |
| `empty` | Centered "Waiting for the first athlete…" with a slow pulse |
| `error` | Muted "Feed unavailable" + hint to open setup (no raw stack traces) |
| `reconnecting`/`polling` | Last known rows stay visible, slightly dimmed, small "reconnecting" pill |
| `offline` | Rows stay live (local data); unobtrusive offline pill, since internet ≠ feed |
| `live` | Normal animated rows |

### `FeedRow` (Framer Motion)
- List rendered inside `<AnimatePresence mode="popLayout">`, keyed by `entry.id`.
- Each row is `motion.div` with `layout` (auto-animates the downward shift when a new row enters).
- Variants (flip board):
  - `initial`: `{ rotateX: -90, opacity: 0 }`, `transformOrigin: top`, perspective on the parent.
  - `animate`: `{ rotateX: 0, opacity: 1 }`, spring/tween ~0.45s.
  - `exit`: `{ rotateX: 80, opacity: 0 }`.
- Newest row (`index 0`): split-tinted background (`color-mix`), slightly larger type, heavier weight.
- **Reduced motion:** `useReducedMotion()` → swap flip for a simple fade/auto height.
- Content: hairline split-colored left accent (`box-shadow: inset 3px 0 0`), bib (accent, tabular), name (semibold), `SplitBadge`, time (tabular, muted) right-aligned.

### `SplitBadge`
Phosphor icon + uppercase label, colored by split. Icon mapping in `format.ts` (e.g. swim/bike/run Phosphor glyphs). Single source of truth for split → {color token, icon, label}.

### `SetupDrawer`
Off-broadcast panel (shadcn drawer/sheet, toggled by a corner gear button + hotkey, e.g. `S`):
- **File picker:** lists `/api/feed/files`, select one (persisted).
- **Thresholds:** numeric inputs for swim end, bike end, grace (mm:ss helpers); live-applied.
- **Connection:** status indicator, polling interval, "always use polling" toggle.
- **Display:** fullscreen toggle.
- Every control has hover/focus/disabled states (shadcn defaults) and is keyboard-accessible.

### `RaceClock` + `ClockControls` (`/clock`, 320×64)
- `RaceClock` renders the running clock large and centered: Inter, tabular numerals, `HH:MM:SS` (drops to `H:MM:SS` under an hour). White background to match the arc. A subtle pulse on the colon or a paused-state dim communicates run/pause.
- Driven by `use-race-clock.ts`: persists `{ startedAtMs, accumulatedMs, running }` to `localStorage` (key `lion-central.clock`). Ticks via a 250ms interval for smooth seconds; computes elapsed from timestamps (robust to refresh / tab-throttle). Exposes `start / pause / reset / setElapsed`.
- `ClockControls`: off-broadcast drawer (gear + hotkey `C`) with **Start/Pause**, **Reset**, **Set start** (manual offset), and **Fullscreen**.
- This is operator-driven, not backend-fed — documented assumption; if the timing backend later exposes a master clock we can swap the source behind the same hook.

---

## 8. Offline / Error Handling (design-rule coverage)

- **Loading, error, offline, empty, live** all explicitly designed (table in §7).
- Self-hosted fonts via `next/font` (Inter) → no CDN dependency at runtime.
- Network actions degrade gracefully: SSE → polling → "reconnecting" with last-known data retained.
- No selected file / `FEED_DIR` unset → `error` state pointing the operator to the drawer.
- Malformed lines are skipped, never fatal.
- Offline banner shown per design rules, but copy clarifies the feed is local and still live.

---

## 9. Styling & Tokens

- Add split tokens to `app/globals.css` (`:root` and `.dark`): `--swim`, `--bike`, `--run`, exposed via `@theme inline` as `--color-swim/bike/run`. Tints derived with `color-mix`.
- The `/live` and `/clock` display surfaces use a **white** background regardless of app theme (matches the physical arc).
- **Inter** added via `next/font/google` and applied to the display surfaces (tabular numerals for bib/time/clock). App-wide adoption can come later.
- Tailwind-only styling; no inline styles **except** the dynamic `transform: scale()` in `ScaleToFit` and the dynamic region sizing in `TopBarStage`/`SponsorSlot`, which are computed at runtime from layout constants and cannot be static Tailwind classes. Reuse shadcn primitives for drawers/controls.

---

## 10. Configuration

`.env.local` (not committed):
```
FEED_DIR=C:\path\to\timing\feeds
```
- `FEED_DIR` is the only required config. Absolute path to the folder containing the `.txt` feed file(s).
- Document in `README.md`. Add `.superpowers/` to `.gitignore` (brainstorm mockups).

---

## 11. Local-Only Guard

`/live` and `/api/feed/*` read the local filesystem and must **never** be deployed to production (per Architecture rules). Mitigations:
- Documented as local-only.
- Feed routes return `404`/`403` when `FEED_DIR` is unset (the natural state in any deployed env).
- Optional `LIVE_FEED_ENABLED` env flag to hard-disable the routes outside local use.

---

## 12. Dependencies

- **Added:** `motion` (Framer Motion's current package; import from `motion/react`), `vitest` (dev).
- **Reuse:** `@phosphor-icons/react` (icons), shadcn primitives, `tw-animate-css` (skeleton pulse), `next/font` (Inter).
- Not adding GSAP / Three.js / Lottie for this feature.

---

## 13. Testing

Pure logic is unit-tested (recommend adding **Vitest** — no runner present yet):
- `parse.ts`: valid lines, repeated spaces, multi-word names, `HH:MM:SS`/`MM:SS`, malformed → `null`, partial line.
- `splits.ts`: each split window, exact boundaries, grace buffer behavior.
- `tail.ts`: `safeResolve` rejects traversal/escape; `readLastLines` returns correct last-N from a large/edge file.

Manual verification: point `FEED_DIR` at a scratch file, append lines, confirm flip-in, reorder, oldest-out; kill/restart the dev server to confirm reconnect→polling→recover; toggle thresholds and watch live recolor.

Add `scripts`: `typecheck` (`tsc --noEmit`) and `test` (`vitest run`). Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` after implementation (per Commands).

---

## 14. Build Sequence

1. `lib/arc/layout.ts` constants; `lib/feed/*` pure logic (types, parse, splits, format) + tests.
2. `lib/feed/tail.ts` (tail read + path guard) + tests; `vitest.config.ts`; package scripts.
3. Route handlers: `files`, `tail`, then `stream`.
4. `use-feed-settings`, `use-online-status`, `use-feed`, `use-race-clock` hooks.
5. Tokens + Inter font wiring in `globals.css` / layout.
6. `SplitBadge`, `FeedRow`, `feed-state-overlays`, `LiveFeedBar`.
7. `ScaleToFit`, `SponsorSlot`, `TopBarStage`, `SetupDrawer`, `app/live/page.tsx`.
8. `RaceClock`, `ClockControls`, `app/clock/page.tsx`.
9. `pnpm lint` + `pnpm typecheck` + `pnpm test`; manual verification against a scratch feed file.

---

## 15. Out of Scope (future sessions)

Arc Control panel (presets, animation slots, **sponsor-logo management**, live switching), the left/right arc legs (128×640), the central stage screen (1024×512), and any non-display pages. Sponsor zones here are placeholder slots only.
