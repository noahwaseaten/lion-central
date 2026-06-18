# Arc Control — Free-Canvas Workspace

**Date:** 2026-06-17
**Status:** Proposed
**Supersedes (in part):** `2026-06-16-arc-control-2d-workspace-design.md` (fixed-zone model)

## Summary

Turn each arc surface from a set of fixed slots into an open **layout canvas** the
operator composes freely: add any number of components, drag to move, drag handles
to resize, layer and delete them — with snapping and alignment guides. Along the
way, fix the issues raised: the live feed must animate **only when the source
`.txt` file gains a new line** (no perpetual loop), the image component gets a
Figma-style crop/place editor, sponsors render as real per-logo squares, the
output-window menu crash is fixed, presets/saved layouts are added, and the brand
strip is removed entirely.

This replaces the rigid `zones: Record<ZoneId, ZoneContent>` model with per-surface
component lists. It is one cohesive change because the layout model, the stage
editor, the compositor, and persistence all move together.

## Goals

1. **Free composition** — each surface (top bar, clock, each leg) hosts an
   arbitrary, ordered list of components placed by normalized rect.
2. **Direct manipulation** — move/resize on the stage with snapping + guides; an
   image crop editor that pans on drag and zooms on scroll, like Figma.
3. **Append-only feed motion** — the ticker is static between appends and glides
   exactly one row when a new athlete line is appended to the file.
4. **Per-logo sponsors** — grid mode lays out equal square cells, one logo each.
5. **Presets** — built-in modes (Live feed / Feed off) plus custom saved layouts.
6. **Stability** — the outputs menu opens without crashing; persisted configs
   migrate cleanly to the new model.
7. **Remove brand** — drop the `brand` content type and the brand strip.

## Non-goals

- Multi-select / marquee on the stage (single selection in this pass).
- Drag-and-drop reordering in the layers panel (use up/down + bring forward/back).
- Per-logo crop transforms inside the sponsors grid (sponsors stay contain-fit;
  fine-grained placement is what individual image components are for).

---

## Data model

New module `lib/arc/layout-model.ts` owns the shape.

```ts
export interface NormRect { x: number; y: number; w: number; h: number } // 0..1 of the surface

export interface ArcComponent {
  id: string;            // stable, unique within the config
  name?: string;         // optional operator label (falls back to content label)
  content: ZoneContent;  // from content.ts (brand removed; image/sponsors extended)
  rect: NormRect;        // position + size, normalized to the owning surface
}

export interface ArcConfig {
  background: string;                          // arc surface background (physical arc is white)
  surfaces: Record<SurfaceId, ArcComponent[]>; // array order = paint/z order (last = on top)
}
```

- **Z-order is array order.** Last element paints on top. "Bring forward/back"
  and the layers panel reorder the array.
- **Normalized rects** keep components resolution-independent: a surface's native
  px size (`layout.ts`) only matters at paint and interaction time, so outputs and
  the stage agree exactly.
- `SurfaceId` stays `"clock" | "topbar" | "leg-left" | "leg-right"`. The `Zone`
  / `ZoneId` concept is retired; the legacy zone→rect table lives only in the
  migration (below).

### Content changes (`lib/arc/content.ts`)

- **Remove** the `brand` variant from `ZoneContent`, `CONTENT_TYPES`,
  `defaultContent`, and `CONTENT_META`.
- **Extend `image`** for crop/place:
  ```ts
  | { type: "image"; src: string; fit: "contain" | "cover";
      scale: number;                 // multiplier on the fit baseline (1 = fit, >1 crops in)
      offset: { x: number; y: number }; // pan, as a fraction of the inner frame
      padding: number;               // inset, fraction of min(w,h), 0..0.4
      background: string | null }    // solid behind the image (for white/transparent logos)
  ```
- **Extend `sponsors`** for square layout:
  ```ts
  | { type: "sponsors"; images: string[]; mode: "rotate" | "grid";
      intervalMs: number;
      columns: number | "auto";      // grid columns; "auto" picks near-square cells
      cellPadding: number }          // inset per cell, fraction of cell, 0..0.4
  ```
- A `normalizeContent()` helper back-fills these fields on load so older persisted
  content (and presets) never renders broken.

### Default config

`DEFAULT_ARC_CONFIG` becomes free-canvas defaults that mirror today's look minus the
brand strip (feed now claims the full center-column height):

| Surface | Components (norm rect) |
|---|---|
| `clock` | clock `{0,0,1,1}` |
| `topbar` | left sponsors `{0, 0, 0.246, 1}`, feed `{0.246, 0, 0.508, 1}`, right sponsors `{0.754, 0, 0.246, 1}` |
| `leg-left` | sponsors (grid) `{0,0,1,1}` |
| `leg-right` | sponsors (grid) `{0,0,1,1}` |

### Migration (`hooks/use-arc-config.ts` → `migrate()` in `layout-model.ts`)

Persisted config in `localStorage["lion-central.arc"]` is the old zone shape, so:

- If parsed has `surfaces` → already new; run `normalizeContent` on every component.
- Else if parsed has `zones` → convert each zone to a component using a static
  legacy table (old surface + native rect → normalized rect within that surface).
  **The `brand` zone is dropped.** Old `image` zones get the new fields back-filled.
- Else → `DEFAULT_ARC_CONFIG`.

Legacy zone table (from the retired `surfaces.ts`):
`clock-main`→clock full · `shoulder-left`→topbar `{0,0,0.246,1}` · `feed`→topbar
`{0.246, 0.39, 0.508, 0.61}` · `shoulder-right`→topbar `{0.754,0,0.246,1}` ·
`leg-left-panel`→leg-left full · `leg-right-panel`→leg-right full · `brand`→dropped.

---

## Rendering (canvas compositor)

The compositor stays the single renderer for stage + outputs.

- **`compositor.ts`** — `drawSurface` fills the background, then iterates
  `config.surfaces[id]` in array order, calling `drawComponent(ctx, pxRect, comp.content, inputs, tMs, comp.id)`.
  `pxRect = norm × surface{w,h}`.
- **`zones.ts`** — `drawZone` → `drawComponent`, taking a `componentId` it threads
  to painters that hold per-instance state. The `brand` case and `paintBrand`/
  `drawPulse`/brand constants are removed.
- **Per-instance state** — feed ticker state moves from `WeakMap<canvas, State>`
  to `WeakMap<canvas, Map<componentId, State>>`, so two feed components on one
  canvas animate independently. Sponsor rotate is stateless (driven by `tMs`).
- **Feed rows adapt to height** — `paintFeed` derives row count from its pixel
  height (`rows = clamp(round(h / ~62px), 1, 6)`) instead of the fixed `FEED_ROWS`,
  since the feed component is now resizable.

### Live feed animation — append-driven (`feed-anim.ts` rewrite)

Delete the perpetual scroll loop. New behavior, keyed per (canvas, componentId):

- Track seen ids in arrival order. The visible set is the latest `min(n, rows)`
  entries, **newest at the bottom**, static.
- When the newest id changes (a new line was appended to the file), set
  `glideStart = now`. Progress `p = easeInOut(clamp01((now - glideStart) / TRANSITION_MS))`.
- During the glide the column sits one row lower and slides up by `(1 - p)·rowH`;
  the just-arrived row fades in (`alpha = p`); if `n > rows`, the row leaving the
  top fades out (`alpha = 1 - p`). At `p = 1` everything is static — **no internal
  clock, so nothing animates until the next append.**
- Reduced motion: `p = 1` immediately (instant swap, no glide).
- Freshness wash on the newest row decays over `FRESH_MS`, then static.

This is the core fix for "it just does the same thing over and over": motion is now
strictly a function of new file data, exactly as agreed.

### Image painter (`paintImage`) — shared transform

1. If `background`, fill the component rect with it.
2. Inner rect = rect inset by `padding · min(w, h)`.
3. Baseline scale fits the image into the inner rect (`contain` = min, `cover` = max).
4. Final scale = `baseline · scale`.
5. Draw centered in the inner rect, shifted by `offset.{x,y}` (× inner w/h),
   clipped to the inner rect.

The crop editor uses this exact math, so the editor preview equals the output.

### Sponsors painter (`paintSponsors`) — square cells

- `rotate` mode unchanged.
- `grid` mode: `count = images.length`. Columns = `columns` if numeric, else
  `clamp(round(sqrt(count · w/h)), 1, count)` (near-square cells). `rows =
  ceil(count/cols)`. Each logo is `contain`-fit, centered in its cell inset by
  `cellPadding · min(cellW, cellH)`. On a tall leg this yields a clean vertical
  stack of square logos — the "individual squares for each logo" request. Empty
  state (no images) shows placeholder cells only in the editor context.

---

## Stage editor (`arc-stage.tsx` + new pieces)

Keep the existing pan/zoom/Fit view machinery and `StageDecor`. Replace the
fixed `ZoneHotspot`s with an interactive component layer.

- **Selection** is now `{ surface: SurfaceId; id: string } | null`, shared with the
  layers panel and inspector.
- **`ComponentFrame`** (`component-frame.tsx`) — an absolutely-positioned overlay
  per component (surface placement + `norm × scale`). Renders the clean amber
  selection ring + label chip, a drag surface (move), and 8 resize handles.
  - Pointer deltas (CSS px) → native px (`÷ view.scale`) → norm (`÷ surface size`)
    → patch `comp.rect`. Minimum size enforced; allowed to sit anywhere on its
    surface.
  - `Delete`/`Backspace` removes the selected component; arrows nudge; `Esc`
    deselects. (Guarded so typing in inputs is unaffected.)
- **Snapping** (`lib/arc/snapping.ts`, pure + unit-tested) — snap moved/resized
  edges and centers to the surface's 0 / 0.5 / 1 lines and to sibling component
  edges/centers within a screen-px threshold; returns the snapped rect plus the
  guide lines to draw. The stage renders guides while dragging.
- **Add** (`add-component-menu.tsx`) — a small "+ Add" control per surface inserts
  a default-sized component (`{0.25, 0.25, 0.5, 0.5}`) of the chosen type and
  selects it.
- Background drag / middle / space still pans; pointerdown on a `ComponentFrame`
  starts move/resize instead of panning.

## Layers panel (`zone-rail.tsx` → `layers-panel.tsx`)

Per surface, list its components in z-order (top first): content icon + name,
select, delete, up/down reorder buttons, and a per-surface "+ component". Selection
is synced both ways with the stage.

## Inspector (`zone-inspector.tsx`)

For the selected component:

- **Shows** — type picker (swaps content, keeps rect).
- **Settings** — `ZoneFields`, with the new **`ImageCropEditor`** for image
  components and the new columns/cell-padding controls for sponsors.
- **Position & size** — numeric X/Y/W/H (in %), align buttons (left/center/right,
  top/middle/bottom within the surface), and layer controls (bring forward/back,
  to front/back).
- Feed source / race clock sections as today (shown for those types).

### Image crop editor (`image-crop-editor.tsx`)

A preview box at the component's true aspect ratio (computed from its rect × the
surface's native size), drawn by a small canvas using `paintImage` with the live
content. Interactions:

- **Drag inside** = pan (updates `offset`, clamped).
- **Scroll / pinch** = zoom (updates `scale`, anchored at the cursor by adjusting
  `offset` so the point under the cursor stays put).
- Buttons: **Fit** (contain, scale 1, offset 0), **Fill** (cover, scale 1, offset
  0), **Reset**. Sliders: **Zoom** (1–4×), **Padding** (0–40%). A **background**
  swatch with a "none" toggle. Direct manipulation first; sliders secondary.

---

## Presets / saved layouts

- **`lib/arc/presets.ts`** — `BUILTIN_PRESETS`: **Live feed** (= default) and
  **Feed off** (top-bar feed replaced by a sponsors component). Each is a full
  `ArcConfig`.
- **`hooks/use-presets.ts`** — custom presets in `localStorage["lion-central.presets"]`
  (`{ id, name, config }[]`): `apply`, `saveCurrent(name)`, `remove(id)`.
- **`use-arc-config.ts`** gains `replaceConfig(config)` so a preset can swap the
  whole layout at once (still persisted + cross-tab synced).
- **`presets-menu.tsx`** — a toolbar dropdown: built-ins, custom presets (with
  delete), and "Save current layout…". Built using the fixed menu primitives.

## Menu crash fix (`components/ui/menu.tsx`)

`MenuLabel` renders Base UI `Menu.GroupLabel`, which requires a `<Menu.Group>`
ancestor it never gets — this is the `MenuGroupContext is missing` crash when
opening Outputs. Fix: render `MenuLabel` as a plain styled, non-interactive element
(a section heading, no group dependency). Also export `MenuGroup`, `MenuRadioGroup`,
and `MenuRadioItem` so the presets menu can show the active preset correctly.

---

## Files

**New**
- `lib/arc/layout-model.ts` — types, defaults, `migrate`, `normalizeContent`, norm↔px helpers, id gen.
- `lib/arc/snapping.ts` — snap + guide computation (pure).
- `lib/arc/presets.ts` — built-in presets.
- `hooks/use-presets.ts` — custom preset storage + ops.
- `components/control/workspace/component-frame.tsx` — move/resize overlay.
- `components/control/workspace/add-component-menu.tsx` — add-to-surface control.
- `components/control/workspace/presets-menu.tsx` — toolbar presets dropdown.
- `components/control/image-crop-editor.tsx` — Figma-style crop/place editor.
- `lib/arc/layout-model.test.ts`, `lib/arc/snapping.test.ts`, `lib/arc/render/feed-anim.test.ts` — vitest pure-logic tests.

**Modified**
- `lib/arc/content.ts` — remove brand; extend image/sponsors; `normalizeContent`.
- `lib/arc/render/{compositor,zones,feed-anim}.ts` — new model, per-instance state, painters, feed rewrite.
- `hooks/use-arc-config.ts` — new model, component ops, migration, `replaceConfig`.
- `components/control/workspace/{arc-workspace,arc-stage,zone-inspector,top-toolbar}.tsx` — selection model, stage editing, inspector, presets.
- `components/control/workspace/zone-rail.tsx` → `layers-panel.tsx`.
- `components/control/{zone-content-editor}.tsx`, `workspace/content-meta.tsx` — remove brand, image editor, sponsor fields.
- `components/ui/menu.tsx` — crash fix + group exports.
- `lib/arc/surfaces.ts`, `lib/arc/stage-layout.ts` — drop the zone arrays / `zoneRectNative`; keep surface dimensions + placements.

**Unchanged**
- `app/output/[surface]/page.tsx`, `components/arc/surface-output.tsx`,
  `hooks/use-surface-canvas.ts`, feed data hooks/routes (`use-feed`,
  `/api/feed/*`) — they already read through the compositor / settings.

## Testing

- **Pure logic (vitest):** migration (old zone config → components, brand dropped,
  image fields back-filled), norm↔px round-trips, snapping math, and the feed
  ticker (static between appends; one-step glide on a new id; reduced-motion
  instant; history bound).
- **Manual:** open each `/output/*` (no crash), append lines and watch the single
  glide, add/move/resize/delete components with snapping, crop an image, switch
  presets, save/apply/delete a custom preset, reload (persistence) and open a
  second tab (cross-tab sync).

## Revision — round 2 (2026-06-17)

Added after the designer confirmed measurements and the operator refined requirements:

- **Module dimensions (confirmed).** The physical arc is built from 256×128px
  (1000×500mm) and 128×128px (500×500mm) LED modules; the clock is a separate
  unit. `layout.ts` already matches: top bar 1280×256 = a 5×2 grid of rect
  modules, each leg 128×640 = five square modules, clock separate. No change
  forced; revisit module counts only if the physical build differs.
- **Server-side logo library** (`lib/arc/assets-store.ts`, `app/api/assets/*`,
  `hooks/use-logo-library.ts`, `components/control/logo-library.tsx`). Logos are
  uploaded once to a local assets dir (`ASSETS_DIR` env, else `<cwd>/.lion-assets`)
  and served by stable URL, so they persist across tabs and any device on the
  server — replacing per-browser data URLs. Sponsor and image components pick from
  the shared gallery; content still stores plain URLs (no model change).
- **NumberFlow clock.** Clock content gains `numberFlow: boolean`. When on, the
  clock renders via the real `@number-flow/react` library as a DOM overlay
  (`components/arc/number-flow-clock.tsx` + `surface-clock-overlay.tsx`) layered on
  the canvas in both the workspace and `/output`; the canvas painter skips that
  region. When off, the canvas clock is unchanged.
- **Inspector consistency.** The Position & Size (X/Y/W/H + align + layer) group is
  now consistently the **last** group for every component type.

## Risks

- **Persisted config migration** is the main risk — a wrong table leaves operators
  with a broken layout. Covered by unit tests and a safe fallback to defaults on
  any parse failure.
- **Stage interaction complexity** — kept bounded by single-selection, button-based
  reordering, and isolating drag/resize/snap into tested pure helpers.
