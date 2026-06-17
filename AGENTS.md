<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: [Lion Central] Arc Control & Live Feed App

## Stack
- Next.js (App Router), TypeScript, pnpm
- shadcn/ui (preset: b2BVA82Vs, base theme, pointer variant)
- Tailwind CSS

## Commands
- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm lint` — lint check
- `pnpm typecheck` — type check (run after changes)
- `pnpm test` — vitest (pure-logic unit tests)

## Architecture
- App is private/internal — no public auth, no monetization
- LOCAL ONLY — reads/writes a .txt file on the local filesystem; never deployed to production (feed routes 404 when `FEED_DIR` is unset)
- Authoritative design: `docs/superpowers/specs/2026-06-16-arc-control-unified-design.md` (surface/zone model, outputs) + `docs/superpowers/specs/2026-06-16-arc-control-2d-workspace-design.md` (the 2D control workspace that replaced the 3D preview). `SPEC.md` points to the first.

### Unified Arc Control app
- The arc is an inverted-U: a **top bar** (1280×256) with a **clock panel** (384×96) on top-center, and two **legs** (128×640) hanging from the sides. Front & back faces are screens; inner/top/bottom edges are bare frame.
- Modeled as **surfaces** → **zones** in `lib/arc/surfaces.ts` (geometry derived from `lib/arc/layout.ts`). Top-bar zones (option B): shoulders 315×256, brand strip 650×100, live feed 650×156.
- Each zone shows a **content** assignment (`lib/arc/content.ts`): feed, clock, brand (the LION ◆ HEART lockup with its heartbeat pulse), text, sponsors (rotate/grid), image, video, color, off. Stored in `ArcConfig` (`hooks/use-arc-config.ts`), persisted + synced across tabs via `storage` events.
- **Canvas compositor** (`lib/arc/render/*`) is the single renderer for every surface — used by both the 2D workspace stage and the outputs so they never diverge. Canvas drawing here is rendered display output, NOT app UI (a deliberate exception to "Tailwind/shadcn only", which still governs the control panel).
- Routes: `/` = 2D control workspace (`components/control/workspace/*`: toolbar, zone rail, interactive arc stage, inspector). `/output/[surface]` = clean full-screen render of one surface (`topbar`/`clock`/`leg-left`/`leg-right`) for a physical LED/projector.
- The arc **stage** (`arc-stage.tsx`) is a pannable/zoomable editor canvas: ⌘/Ctrl-wheel (or pinch) zooms toward the cursor, plain wheel / background-drag / middle-drag / space-drag pans, Fit recenters. Click a zone (on the arc or in the rail) to select it; selection is a single clean amber ring.
- Brand assets live in `public/`: `long_logo.png` (white horizontal wordmark, used in the toolbar) and `square_logo.jpeg` (color lion mark). The wide white arc has no usable wide logo asset, so the `brand` painter recreates the lockup; `three` is currently unused (left in `package.json`).

## Design Rules (NON-NEGOTIABLE)
- Consistent across all pages: same spacing scale, same color tokens, same component variants
- Simple and intuitive — no decorative complexity
- Every interactive element must have: hover, focus, loading, and error states
- Offline-first awareness: show offline banner when no connection, disable network actions gracefully
- Use shadcn components as the base — do not reinvent UI primitives

## Live Feed Feature
- Reads last 3 lines of a local .txt file (SSE push via `fs.watch`, polling fallback)
- Format per line: `BIB FIRSTNAME LASTNAME TIME`
- This is a triathlon — splits are Swim, Bike, Run, inferred from cumulative TIME vs operator thresholds (color/label per split)
- Rendered by the canvas compositor in the `feed` zone as a **broadcast ticker** (`lib/arc/render/feed-anim.ts`): each canvas accumulates the athletes it has seen and the column dwells then glides upward one row at a time, looping through recent finishers (reduced-motion shows the latest statically). The most-recent feed file is auto-selected so the feed connects out of the box on every screen.
- Test tool: `POST /api/feed/append?file=` writes a random athlete line (toolbar button) so the ticker can be previewed without the timing backend

## Code Style
- TypeScript strict mode
- Named exports, no default exports except pages
- Components in /components, pages in /app
- No inline styles — Tailwind only
- Keep components small and focused

## Git
- Branch per feature: `feature/live-feed`, `feature/arc-control`
- Commit per logical change, not per file