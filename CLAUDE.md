# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: [Lion Central] Arc Control & Live Feed App

# Token Optimization & Autonomy Constraints

- DO NOT invoke `superpowers:brainstorming` or spawn ideation subagents. Answer directly or ask clarifying questions in the main thread to minimize token usage.
- DO NOT invoke web browser actions, run manual tests, or execute non-essential setup/verification commands that consume tokens. If a task can be tested or performed manually by the user, explicitly direct the user to perform it with concise step-by-step instructions instead.

## Stack
- Next.js (App Router), TypeScript, pnpm
- shadcn/ui (preset: b2BVA82Vs, base theme, pointer variant)
- Tailwind CSS, Phosphor icons (`@phosphor-icons/react`)

## Commands
- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm lint` — lint check
- `pnpm typecheck` — type check (run after changes)
- `pnpm test` — vitest (pure-logic unit tests only; canvas/DOM is not tested)
- `pnpm test -- path/to/file.test.ts` — run a single test file
- `pnpm test -- -t "pattern"` — run tests matching a name pattern

## Architecture

### Big picture
- App is private/internal — no public auth, no monetization
- LOCAL ONLY — reads/writes a `.txt` file on the local filesystem; never deployed to production (feed routes 404 when `FEED_DIR` is unset)
- Routes: `/` = 2D control workspace; `/output/[surface]` = clean full-screen render for a physical LED/projector
- Authoritative design specs live in `docs/superpowers/specs/` — the free-canvas spec (`2026-06-17-arc-free-canvas-workspace-design.md`) is current and supersedes earlier fixed-zone designs

### Arc hardware model
- The arc is an inverted-U: **top bar** (1280×256 px), **clock panel** (384×96 px, sits top-center), and two **legs** (128×640 px each)
- Dimensions live in `lib/arc/layout.ts`; the four surface IDs (`topbar`/`clock`/`leg-left`/`leg-right`) are in `lib/arc/surfaces.ts`

### Free-canvas layout model (`lib/arc/layout-model.ts`)
- Each surface holds an ordered array of `ArcComponent = { id, name?, content, rect }` — `rect` is normalized 0–1 of the surface; array order = z/paint order
- `ArcConfig = { background, surfaces: Record<SurfaceId, ArcComponent[]> }`, persisted to localStorage and synced across tabs via `storage` events
- `migrate()` upgrades old configs (including retired fixed-zone shape) to the current model — always call when reading from storage or a preset

### Draft / live split
- `useArcConfig("draft")` — used by the workspace (`ArcWorkspace`). Edits go to `lion-central.arc.draft`. Call `publish()` to push to the live key so output tabs update. Tracks `isDirty`.
- `useArcConfig("live")` — used by output pages (`SurfaceOutput`). Reads `lion-central.arc` and reacts to storage events in real time.

### Canvas compositor (`lib/arc/render/`)
- `drawSurface` (compositor.ts) → `drawComponent` (zones.ts) — the **single renderer** for every surface; used by both the workspace stage and the `/output` pages so they never diverge
- Each call receives `SurfaceInputs = { config, feed: { entries, status }, clock: { ms, running } }` — this is the entire data pipeline into the canvas
- Canvas drawing is **rendered display output**, not app UI. Tailwind/shadcn only governs the control panel
- Exception: NumberFlow clocks render as a DOM overlay (`components/arc/surface-clock-overlay.tsx`) layered on top of the canvas in both stage and `/output`
- `drawComponent` threads `componentId` to painters that hold per-instance state (e.g., `feed-anim.ts` keyed by id)

### Component content types (`lib/arc/content.ts`)
`ZoneContent` union: `feed` | `clock` (with `numberFlow` toggle) | `text` | `sponsors` (rotate/grid) | `image` (with `ImageTransform`: fit/scale/offset/padding/background) | `video` | `color` | `off`
- `normalizeContent()` coerces any persisted/preset shape into a valid `ZoneContent`; unknown types (e.g., retired `brand`) fall back to `text`

### Workspace UI (`components/control/workspace/`)
- `ArcWorkspace` — root: wires config, feed, clock, presets together; assembles `SurfaceInputs`; passes draft config and callbacks down
- `TopToolbar` — presets menu, feed settings, clock controls, publish button
- `LayersPanel` (left rail) — per-surface component list with add/remove/reorder
- `ArcStage` — pannable/zoomable canvas editor: ⌘/Ctrl-wheel (or pinch) zooms, plain wheel/background-drag/middle-drag/space-drag pans. Each component is a `ComponentFrame` (move + 8-handle resize). Alignment snapping in `lib/arc/snapping.ts`
- `ZoneInspector` (right rail) — inspector for the selected component; content type switcher + per-type controls + feed/clock settings

### Presets (`lib/arc/presets.ts` + `lib/arc/presets-store.ts` + `hooks/use-presets.ts`)
Full-layout snapshots, applied via `replaceConfig` — no built-ins, operator-saved only. Persisted server-side to a JSON file on disk (`PRESETS_DIR` env, else `<cwd>/.lion-presets/presets.json`, served by `app/api/presets/*`) rather than localStorage, so saved layouts travel with the repo (`git pull` gives every clone the same presets) instead of being stuck in one browser. The workspace tracks which preset (if any) is currently applied; publishing (`ArcWorkspace`'s `onPublish`) re-saves that preset in place by id automatically, so there's no separate "update" step. The Presets menu's own Save box always creates/replaces by name (for renaming or branching off a copy).

### Logo / asset library
- Server-side storage: `ASSETS_DIR` env (else `<cwd>/.lion-assets`), served by `app/api/assets/*`
- Client split: `lib/arc/assets-shared.ts` (client-safe types/helpers) / `lib/arc/assets-store.ts` (Node.js fs — server only)
- `hooks/use-logo-library.ts` + `components/control/media-library/` — gallery UI; sponsors and image components pick from it; content stores plain URLs

### Live feed feature
- SSE push via `fs.watch`, polling fallback; `FEED_ROWS` lines from a local `.txt` file
- Format per line: `BIB FIRSTNAME LASTNAME TIME`
- Race category (Ultra / Half / Relay) inferred from the BIB in `lib/feed/categories.ts` — ultra 0–264, half 400–700, relay 800+, anything else `other`; colors/labels in `zones.ts`
- The feed file is never rewritten. The one display-side correction is `FeedOffsets.halfOffsetSec` (`lib/feed/offsets.ts`): half marathons start later but share the feed's gun time, so the operator's offset is subtracted from half times only, producing `displaySeconds`/`displayTime` while `seconds`/`timeRaw`/`id` stay raw
- Rendered as an **append-driven ticker** (`lib/arc/render/feed-anim.ts`, per-component-id state): static except when a new athlete appears — then glides up one row, then rests. No perpetual loop.
- Test: `POST /api/feed/append?file=` writes a random athlete line (toolbar button)

## Design Rules (NON-NEGOTIABLE)
- Consistent across all pages: same spacing scale, same color tokens, same component variants
- Simple and intuitive — no decorative complexity
- Every interactive element must have: hover, focus, loading, and error states
- Offline-first: show offline banner when no connection, disable network actions gracefully
- Use shadcn components as the base — do not reinvent UI primitives

## Code Style
- TypeScript strict mode
- Named exports, no default exports except pages
- No inline styles — Tailwind only
- Keep components small and focused

## Git
- Commit often, Push when finished
- Never co-author
- Commit per logical change, not per file
