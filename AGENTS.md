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
- Authoritative design: `docs/superpowers/specs/2026-06-16-arc-control-unified-design.md` (surface model, outputs) → `2026-06-16-arc-control-2d-workspace-design.md` (the 2D workspace that replaced the 3D preview) → **`2026-06-17-arc-free-canvas-workspace-design.md` (current model — free-canvas components; supersedes the fixed-zone model).** `SPEC.md` points to the first.

### Unified Arc Control app
- The arc is an inverted-U built from LED modules (256×128 / 128×128 px): a **top bar** (1280×256) with a **clock panel** (384×96, a separate unit) on top-center, and two **legs** (128×640) hanging from the sides. Dimensions live in `lib/arc/layout.ts`; the four **surfaces** (`topbar`/`clock`/`leg-left`/`leg-right`) are in `lib/arc/surfaces.ts`.
- **Free-canvas model** (`lib/arc/layout-model.ts`): each surface holds an ordered list of **components** (`ArcComponent` = `{ id, content, rect }`, `rect` normalized 0–1 of the surface; array order = z order). The operator adds/moves/resizes/layers/deletes them freely. `ArcConfig` (`hooks/use-arc-config.ts`) is `{ background, surfaces: Record<SurfaceId, ArcComponent[]> }`, persisted to localStorage + synced across tabs via `storage` events. `migrate()` upgrades old persisted/preset configs (including the retired fixed-zone shape) to this model.
- A component's **content** (`lib/arc/content.ts`, type `ZoneContent`): feed, clock (with a `numberFlow` toggle), text, sponsors (rotate / square grid), image (with a crop/place transform: `fit`/`scale`/`offset`/`padding`/`background`), video, color, off. (`brand` was removed.)
- **Canvas compositor** (`lib/arc/render/*`) is the single renderer for every surface — used by both the workspace stage and the outputs so they never diverge. `drawSurface` iterates a surface's components in order; `drawComponent` (`zones.ts`) paints each, threading the component id to painters that hold per-instance state. Canvas drawing here is rendered display output, NOT app UI (a deliberate exception to "Tailwind/shadcn only", which still governs the control panel). Exception: NumberFlow clocks render as a DOM overlay (`components/arc/surface-clock-overlay.tsx`) layered on the canvas in both the stage and `/output`.
- Routes: `/` = 2D control workspace (`components/control/workspace/*`: toolbar + presets, layers panel, interactive arc stage, inspector). `/output/[surface]` = clean full-screen render of one surface for a physical LED/projector.
- The arc **stage** (`arc-stage.tsx`) is a pannable/zoomable editor: ⌘/Ctrl-wheel (or pinch) zooms toward the cursor, plain wheel / background-drag / middle-drag / space-drag pans, Fit recenters. Each component is a `ComponentFrame` (move + 8-handle resize) with alignment **snapping** (`lib/arc/snapping.ts`) to surface lines and siblings; selection is a single amber ring. Add components per surface via the stage "Add" chip or the layers panel.
- **Presets** (`lib/arc/presets.ts` built-ins + `hooks/use-presets.ts` custom, localStorage): full-layout snapshots applied via `replaceConfig`. Switch/save in the toolbar.
- **Logo library** (`lib/arc/assets-store.ts`, `app/api/assets/*`, `hooks/use-logo-library.ts`, `components/control/logo-library.tsx`): logos upload to a server-side dir (`ASSETS_DIR` env, else `<cwd>/.lion-assets`) and are served by stable URL, so they persist across tabs/devices. Sponsor & image components pick from the shared gallery; content stores plain URLs.
- Brand assets in `public/`: `long_logo.png` (white wordmark, used in the toolbar) and `square_logo.jpeg` (color lion mark). `three` is unused (left in `package.json`).

## Design Rules (NON-NEGOTIABLE)
- Consistent across all pages: same spacing scale, same color tokens, same component variants
- Simple and intuitive — no decorative complexity
- Every interactive element must have: hover, focus, loading, and error states
- Offline-first awareness: show offline banner when no connection, disable network actions gracefully
- Use shadcn components as the base — do not reinvent UI primitives

## Live Feed Feature
- Reads the last `FEED_ROWS` lines of a local .txt file (SSE push via `fs.watch`, polling fallback)
- Format per line: `BIB FIRSTNAME LASTNAME TIME`
- This is a triathlon — splits are Swim, Bike, Run, inferred from cumulative TIME vs operator thresholds (color/label per split)
- Rendered by the canvas compositor in any feed component as an **append-driven ticker** (`lib/arc/render/feed-anim.ts`, keyed per component instance): it shows the latest finishers (newest at the bottom, row count derived from the component's height) and stays **static**. Only when a new line is appended to the file (a new athlete id appears) does the column glide up exactly one row to reveal it, then rest — there is no perpetual loop. Reduced motion swaps instantly.
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