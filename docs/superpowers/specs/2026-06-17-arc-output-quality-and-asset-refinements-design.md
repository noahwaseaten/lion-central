# Arc Control — Output Quality & Asset Refinements

**Date:** 2026-06-17
**Status:** Proposed
**Builds on:** `2026-06-17-arc-free-canvas-workspace-design.md` (free-canvas model — current). This is a refinement round on top of it; no model concepts are retired.

## Summary

A focused refinement pass on the free-canvas arc workspace, driven by operator and
designer feedback. Eight cohesive changes:

1. **Crisp output** — fix the root cause of blurry / "half quality" rendering: the
   canvas backing store ignores `devicePixelRatio` and the displayed size, so every
   surface renders at a fraction of the available device pixels. Make rendering
   DPR-aware everywhere (stage, `/output`, crop editor).
2. **NumberFlow `will-change`** — hint the animated clock for smoother digit motion.
3. **Output alignment guide** — a toggle-able registration overlay on each
   `/output/[surface]` page so the media team can see the exact surface rectangle to
   map onto the all-white arc, then hide it for broadcast.
4. **Conditional Add + surface selection** — the "+ Add" affordance stops showing on
   every surface by default; a surface becomes selectable, and Add appears only for
   the active surface/component.
5. **Per-asset crop for sponsors & logos** — every sponsor logo gets the same
   full crop/zoom/pan/padding/background editor that standalone images already have.
6. **Reference layout** — confirm module dimensions (already correct), refine sponsor
   grid spacing to an even stack, and ship a "Sponsors populated" preset matching the
   designer's reference.
7. **Feed concurrency & smart-batch motion** — the ticker reveals simultaneous
   arrivals as a single batched glide, snaps instantly on a huge burst, and coalesces
   rapid appends so it never glitches or drops frames under load.
8. **Copy cleanup** — remove redundant "explanatory tail" microcopy throughout the UI.

These move together because they share the same rendering pipeline, content model,
and stage/inspector surfaces.

## Goals

- Output renders at full device-pixel sharpness at any zoom and on any display.
- The media team can precisely center/map each surface onto the physical arc.
- Adding components is intentional, not omnipresent.
- Any uploaded asset — image, logo, or sponsor banner — can be individually cropped.
- Simultaneous finishers never break the ticker's motion or data.

## Non-goals

- Changing the physical arc geometry / module counts (dimensions are confirmed).
- Multi-select / marquee on the stage (single selection stays).
- Bundling actual brand logos in presets (presets carry layout structure only).

---

## 1. DPR-aware rendering (the core quality fix)

### Diagnosis

`hooks/use-surface-canvas.ts` sizes the canvas backing store to the surface's
**native** dimensions (`canvas.width = surface.w`) while the canvas is *displayed*
larger — on the stage when `view.scale > 1`, and on `/output` where `ScaleToFit`
CSS-scales the native canvas up to fill the screen. `devicePixelRatio` is never
applied, so on a 2× display each surface paints at half the device-pixel resolution.
That is the reported "half quality" (full data, half the pixels) and the blurry
lines. `components/control/image-crop-editor.tsx` has the same gap on its preview
canvas.

### Fix

Make the backing store match the **displayed** size × `devicePixelRatio`, and keep
the compositor drawing in native surface coordinates via a base transform:

- `useSurfaceCanvas`:
  - A `ResizeObserver` tracks the canvas's real CSS box (`cssW × cssH`); also react
    to `devicePixelRatio` changes (matchMedia on `resolution`).
  - Set `canvas.width = round(cssW · dpr)`, `canvas.height = round(cssH · dpr)`.
  - Each frame, before `drawSurface`, set the base transform:
    `ctx.setTransform(canvas.width / surface.w, 0, 0, canvas.height / surface.h, 0, 0)`.
    Painters keep working in native coords; `drawComponent`'s `save()/restore()`
    preserves the base transform (verified against `render/zones.ts`).
  - Cap the backing store to a max dimension (e.g. 4096 px on the longer edge) so
    extreme zoom does not allocate oversized buffers; beyond the cap the image is
    still no worse than today.
- `drawSurface` is unchanged — it already draws in native coords and fills the
  background first. Its doc comment is updated: "ctx is expected to map native
  surface units onto its backing store (the caller sets the base transform)."
- `image-crop-editor.tsx`: size its preview canvas to `w · dpr × h · dpr` and scale
  the context, so the editor is crisp and still matches the output.

### NumberFlow

`components/arc/number-flow-clock.tsx`: add the `will-change-transform` Tailwind
class to the clock container so the digit transform animations are GPU-promoted.
(Tailwind class, not an inline style — honors the "no inline styles" rule; existing
dynamic `fontSize/color/opacity` inline styles stay as they are.)

---

## 2. Output alignment guide

A toggle-able **registration overlay** on `/output/[surface]`, rendered as a DOM
overlay (never painted into the canvas, so it cannot leak into the LED data):

- **Contents:** a high-contrast border on the exact surface rectangle, L-shaped
  corner crop marks, a center crosshair (full-height + full-width hairlines), and a
  `LABEL · WxH` dimension readout in a corner.
- **Positioning:** absolute, in display px, inside the `ScaleToFit` wrapper alongside
  the existing `SurfaceClockOverlay`, so it scales 1:1 with the surface.
- **Toggle:** the **G** key and a small corner button (auto-hides when the mouse is
  idle, like video controls). State persists in
  `localStorage["lion-central.output-guides"]`. **Default on** (setup); operators
  press G to hide for broadcast.
- **New file:** `components/arc/output-guides.tsx`; mounted in
  `components/arc/surface-output.tsx`.
- **Stage previews are unchanged** — no outlines are added to the workspace stage;
  the guide is an output-only alignment aid.

---

## 3. Conditional Add + surface selection

- **Selection model** (`lib/arc/layout-model.ts`): extend
  `Selection = { surface: SurfaceId; id: string | null }`. `id: null` = the
  **surface itself** is selected (no component).
- **Stage interaction** (`arc-stage.tsx`, `arc-surface.tsx`):
  - The surface wrapper gets `data-surface={id}`.
  - On `pointerdown` that lands on a surface but not on a component/control, record a
    candidate surface selection; on `pointerup` **without a drag** (within a small
    movement threshold), select that surface (`{ surface, id: null }`). A drag still
    pans, exactly as today.
  - `pointerdown` on the true stage background (outside every surface) deselects.
  - Clicking a `ComponentFrame` selects the component (unchanged).
- **Add gating:** the floating "+ Add" chip renders **only for the active surface** —
  the selected surface, or the surface owning the selected component — instead of one
  per surface always.
- **Layers panel** (`layers-panel.tsx`): the per-surface `+` is shown only on the
  active surface's header; clicking a surface header selects that surface
  (`{ surface, id: null }`) to reveal its Add. Reorder/delete row controls are
  unchanged.
- **Boundary/active emphasis:** the selected surface may carry a subtle highlight on
  the stage; this is presentation only and does not change the output.

---

## 4. Per-asset crop for sponsors & logos

### Shared transform

Factor a reusable transform type in `lib/arc/content.ts`:

```ts
export interface ImageTransform {
  fit: "contain" | "cover";
  scale: number;                     // multiplier on the fit baseline
  offset: { x: number; y: number };  // pan, fraction of the inner frame
  padding: number;                   // inset, fraction of short edge (0..0.4)
  background: string | null;         // solid fill behind; null = none
}
```

- `image` content becomes `{ type: "image"; src: string } & ImageTransform` — same
  field shape as today, just named.
- `sponsors` content changes its image list to per-item objects:
  ```ts
  | { type: "sponsors";
      items: ({ src: string } & ImageTransform)[];   // was images: string[]
      mode: "rotate" | "grid";
      intervalMs: number;
      columns: number | "auto";
      cellPadding: number }                            // grid baseline cell inset
  ```
  Each item's transform applies **inside** its grid cell (or the rotate frame) via
  the existing `drawTransformed`, layered on top of `cellPadding`.

### Migration

`normalizeContent` (`content.ts`) upgrades older content:
- `sponsors.images: string[]` → `items` with a default transform per src
  (`fit: "contain", scale: 1, offset: {0,0}, padding: 0, background: null`).
- Missing/partial item fields are back-filled. Covered by a unit test.

### Rendering

`render/zones.ts` `paintSponsors`:
- `grid`: compute cells as today (with even-gap refinement, §5), then for each item
  draw via `drawTransformed(ctx, img, mw, mh, cellW, cellH, item)` instead of plain
  contain — giving per-logo crop/zoom/pan/background within the cell.
- `rotate`: draw the active item via `drawTransformed` in the component frame.

### UI

- Refactor `image-crop-editor.tsx` to operate on `{ src, transform, aspect, onChange }`
  rather than the whole `ImageContent`, so it serves both standalone images and
  individual sponsor logos. Standalone-image behavior is unchanged.
- The sponsor inspector lists the grid's logos; selecting a logo expands its own
  crop editor, using that cell's aspect ratio (`cellW/cellH` derived from the grid
  layout) so the preview matches the output.

---

## 5. Arc dimensions & reference layout

- **Dimensions confirmed, unchanged.** Top bar 1280×256 (a 5×2 grid of 256×128
  modules), each leg 128×640 (five 128×128 squares), clock 384×96 separate. Matches
  the designer's mm (1000×500 / 500×500). No change to `lib/arc/layout.ts`.
- **Even-gap sponsor grid** (`paintSponsors`): lay out logos with consistent gaps so
  a tall leg reads as an evenly-spaced vertical stack (the reference look). Cells are
  derived from `columns`/`auto` as today; spacing uses a uniform gap rather than only
  per-cell padding, so rows/columns are visually even.
- **"Sponsors populated" preset** (`lib/arc/presets.ts`): a new built-in `ArcConfig`
  reproducing the reference arrangement — top bar with sponsor shoulder stacks plus a
  center title/clock region, and each leg a vertical sponsor stack. It ships the
  **layout structure** (component types, rects, grid settings) with empty sponsor
  `items`; the operator fills logos from the shared library. Selectable from the
  presets menu like the existing built-ins.

---

## 6. Feed concurrency & smart-batch motion

### Animation (`render/feed-anim.ts` rewrite of the glide)

Generalize the single-row glide to a variable batch, keyed per (canvas, componentId)
as today:

- On ingest, determine `newCount` = genuinely-new ids since the last settled state.
- `newCount === 0` → static (no motion), as today.
- `0 < newCount ≤ rows` → one eased glide that shifts the whole visible block up by
  `newCount` rows: `shift = (1 - p) · newCount · rowH`; the newest `newCount` rows
  fade in (`alpha = p`), up to `newCount` displaced rows fade out off the top
  (`alpha = 1 - p`). At `p = 1` everything is static.
- `newCount > rows` (huge burst) → **snap**: set `p = 1` immediately for this update
  (no glide), landing directly on the latest window; resume normal glides after.
- **Coalescing:** if more appends arrive mid-glide, recompute the target to the
  current latest and run a single glide to it — never queue a backlog of animations.
  This is the anti-glitch / no-dropped-frames guarantee.
- Reduced motion: `p = 1` immediately (instant), unchanged.

State carries `glideStart` plus `shiftRows` (replacing the implicit 1). History stays
bounded by `MAX_HISTORY`.

### Data ingestion (`hooks/use-feed.ts`)

Coalesce rapid SSE snapshots into at most one state update per animation frame
(rAF-batched `setRaw`) so a wave of arrivals cannot trigger a React render storm. The
canvas already reads inputs through a ref each frame, so this does not affect paint
latency.

---

## 7. Copy cleanup

Remove redundant "explanatory tail" microcopy — text that narrates the obvious rather
than teaching a non-obvious interaction. Confirmed targets:

- `components/control/logo-library.tsx` empty state: "No logos yet. Upload PNGs once —
  they're saved on the server and available everywhere." → "No logos yet."
- `components/control/image-crop-editor.tsx` caption "Drag to pan · scroll to zoom"
  (redundant with the canvas `aria-label`) — remove.

During implementation, sweep the control panel for the same pattern and trim, keeping
microcopy that explains a genuinely non-obvious gesture.

---

## Files

**New**
- `components/arc/output-guides.tsx` — registration overlay + G-toggle + persistence.
- *(tests)* extend `lib/arc/render/feed-anim.test.ts`; add sponsor-migration cases to
  a content test; add DPR transform-math coverage where it lives as pure logic.

**Modified**
- `hooks/use-surface-canvas.ts` — DPR/displayed-size backing store + base transform.
- `lib/arc/render/compositor.ts` — doc comment only (caller owns the base transform).
- `components/control/image-crop-editor.tsx` — DPR preview; refactor to
  `{ src, transform, aspect }`.
- `components/arc/number-flow-clock.tsx` — `will-change-transform`.
- `components/arc/surface-output.tsx` — mount `OutputGuides`.
- `lib/arc/layout-model.ts` — `Selection.id: string | null`.
- `components/control/workspace/arc-stage.tsx`, `arc-surface.tsx` — surface selection,
  click-vs-drag, Add gating, active highlight.
- `components/control/workspace/layers-panel.tsx` — header selection + Add gating.
- `lib/arc/content.ts` — `ImageTransform`; sponsors `items`; `normalizeContent`
  migration.
- `lib/arc/render/zones.ts` — `paintSponsors` per-item transform + even-gap spacing.
- `components/control/workspace/zone-inspector.tsx` — per-logo crop editors for
  sponsors.
- `lib/arc/presets.ts` — "Sponsors populated" preset.
- `hooks/use-feed.ts` — rAF-coalesced snapshot application.
- `lib/arc/render/feed-anim.ts` — variable-batch glide + snap + coalescing.
- `components/control/logo-library.tsx` and other control-panel copy — trim.

**Unchanged**
- Arc geometry (`lib/arc/layout.ts`, `surfaces.ts`), feed routes/types, cross-tab
  config sync.

## Testing

- **Pure logic (vitest):** sponsor `images → items` migration; feed batch glide
  (multi-id), huge-burst snap, mid-glide coalescing, reduced-motion instant; DPR
  base-transform math (native↔backing round-trip).
- **Manual:** crisp output at high zoom and on a HiDPI / large external display
  (the half-quality regression is gone); G toggles the output guide and state
  persists; selecting a surface reveals its Add and nothing shows when nothing is
  selected; crop an individual sponsor logo and confirm the grid matches; apply the
  "Sponsors populated" preset and fill it; simulate a burst (rapid `/api/feed/append`)
  and confirm a single clean batch glide with no flicker.

## Risks

- **Backing-store sizing** — the main risk; an incorrect transform or resize loop
  could blur or thrash. Bounded by the max-dimension cap, a single `ResizeObserver`,
  and round-trip unit tests on the transform math.
- **Sponsors model migration** — a wrong back-fill could blank existing sponsor
  grids. Covered by a migration unit test and `normalizeContent`'s safe defaults.
- **Click-vs-drag on surfaces** — too tight a threshold makes selection feel
  unresponsive; too loose and pans select by accident. Tune the threshold; keep it
  isolated in the stage pointer handlers.
