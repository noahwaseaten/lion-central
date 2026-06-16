# Arc Control — 2D Interactive Workspace (redesign)

**Date:** 2026-06-16
**Status:** Approved structure (A+C hybrid); implementing.
**Supersedes the 3D preview** in `2026-06-16-arc-control-unified-design.md` for the `/` control
dashboard only. Output routes (`/output/[surface]`), the surface/zone model, the canvas
compositor, feed, and clock are unchanged.

## Goal

Replace the Three.js 3D arc preview with a **2D, directly-manipulable workspace** — an
interactive "customizable tool" feel. The operator sees the arc to-scale, clicks any zone (on
the arc or in a tree) to select it, and edits it in a contextual inspector. Better use of screen
space, full shadcn/base-ui treatment, and a deliberate visual identity that does not read as a
templated AI dashboard.

## Layout (approved: A + C hybrid)

A single full-viewport workspace, dark, four regions:

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOOLBAR  brand · Outputs▾ · clock readout+controls · test · feed · ⚙ │
├──────────┬─────────────────────────────────────────┬─────────────────┤
│ ZONE     │            ARC STAGE (centerpiece)       │  INSPECTOR      │
│ RAIL     │   clock                                  │  selected zone: │
│ (tree    │   ┌───┐                                  │  header         │
│  grouped │  ┌┴───┴┐  inverted-U, to-scale,          │  type segmented │
│  by      │  │█ █ █│  live-rendered surfaces,         │  type fields    │
│  surface,│  │█ █ █│  clickable zone hotspots         │  (+ feed/clock  │
│  status  │  ║     ║  hover lift · viewfinder select  │   settings when │
│  LEDs)   │  ║     ║                                  │   relevant)     │
├──────────┴─────────────────────────────────────────┴─────────────────┤
│ STATUS BAR   ● online · feed transport · N off · autosaved/synced     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Toolbar** — brand wordmark; `Outputs ▾` menu (open each `/output/<surface>` in a new tab,
  plus "Open all"); compact race-clock readout with start/pause/reset; `Test feed line` button;
  feed-transport status chip; appearance popover (arc background color).
- **Zone rail** — every zone grouped by surface (Clock / Top bar / Legs). Each row: status LED +
  label + current content type. Click selects. Mirrors stage selection.
- **Arc stage** — the signature. The four surfaces composited live via the existing
  `useSurfaceCanvas`/`drawSurface`, positioned in the inverted-U to scale, with clickable zone
  hotspots overlaid. Hover lifts a zone and shows a readout chip; selection draws viewfinder
  corner brackets. Fit-to-container with a zoom control (50–150%).
- **Inspector** — contextual editor for the selected zone: header (label · surface), a content-
  type **segmented control**, then the type-specific fields (ported from `ZoneContentEditor`).
  When a `feed` or `clock` zone is selected, its global settings (file/thresholds/polling, or
  clock controls) appear here too. With no selection: appearance + a short hint.
- **Status bar** — online/offline, feed transport (connecting/open/polling/error), count of zones
  set to `off`, and "Autosaved · synced across tabs".

## Visual identity — "triathlon timing console" (deliberately not the AI default)

The generic recommendation (pure-black + single acid-green accent) is a known AI-default look;
we avoid it. The design is grounded in the subject: a timing/OB-truck control surface for the
*Lion ◆ Heart* Olympic Cross Triathlon.

- **Palette — graphite console, not pure black.** Background `#0E1116`, panels `#161A21` /
  `#1B2029`, hairline borders `#262C38`, foreground `#E8ECF2`, muted `#8A93A3`. Functional color
  carries meaning rather than decoration:
  - **discipline triad = data palette** (already in tokens): swim `#38BDF8`, bike `#FB923C`,
    run `#34D399`.
  - **red `#EF4444` = live/recording** (broadcast convention) for the feed-live indicator.
  - **green = connected/online** only. **amber (bike family) = primary action.** No single
    decorative accent.
- **Type — the data is the hero.** Geist Mono (already loaded) for every number/readout (clock,
  splits, bibs, times) with tabular figures; Inter for UI chrome. Personality comes from
  treatment: uppercase micro-labels with wide tracking (console labels), strong numeric scale.
- **Signature element** — the arc stage rendered like a console readout: a faint baseline/gantry
  line under the legs, measurement ticks along the top bar (timing-tape feel), each zone a module
  with a corner index + status LED, **viewfinder corner-bracket selection** (not a dashed
  outline), subtle hover lift.
- **Restraint** — boldness spent on the stage; rail, inspector, toolbar stay quiet and dense.
  Motion limited to 150–250ms CSS transitions (hover/selection/inspector swap); `prefers-reduced-
  motion` respected. Phosphor icons (consistent weight), no emoji.

## Architecture

New components under `components/control/workspace/`:

- `arc-workspace.tsx` — orchestrator; owns `selectedZone`, lays out the four regions.
- `top-toolbar.tsx`, `outputs-menu.tsx`, `clock-mini.tsx`, `appearance-popover.tsx`
- `zone-rail.tsx`
- `arc-stage.tsx` — geometry + positioning; `arc-surface.tsx` (one driven canvas) + zone hotspots.
- `zone-inspector.tsx` — reuses the field editors from `zone-content-editor.tsx` (refactored into
  shared `zone-fields.tsx`), plus `FeedSettingsSection` / `ClockSection` inline.
- `status-bar.tsx`

Reused unchanged: `lib/arc/render/*`, `lib/arc/surfaces.ts`, `lib/arc/layout.ts`,
`use-surface-canvas`, `use-arc-config`, `use-feed*`, `use-race-clock`, `use-online-status`,
`TestToolsSection`, `OfflineBanner`.

New small primitives in `components/ui/` as needed (base-ui backed): `badge.tsx`, `popover.tsx`,
`menu.tsx`, `segmented-control.tsx`, `slider.tsx`.

Removed: `components/arc/arc-preview-3d.tsx` and its use in `app/page.tsx`. The `three` dependency
becomes unused (left in `package.json`; can be pruned later).

### Stage geometry

Bounding box in native px: width `TOP_BAR.w` (1280), height `CLOCK.h + TOP_BAR.h + LEG.h` (992).
`scale = min(W/1280, H/992) · padding · zoom`. Absolute placement (× scale):
clock `left 448, top 0`; topbar `left 0, top 96`; leg-left `left 0, top 352`;
leg-right `left 1152, top 352`. Each surface is a native-size `<canvas>` shown at `w·scale ×
h·scale`. Zone hotspots overlay each surface at `zone.rect · scale` offset by the surface origin.

### Theme application

The dashboard renders inside a `.dark` scope with the graphite tokens above (override the current
achromatic dark tokens in `globals.css` toward graphite + functional accents). Output routes are
unaffected (they paint the white physical arc from `config.background`).

## Quality floor

Keyboard: rail rows and zone hotspots are real buttons (focus ring, Enter/Space, tab order matches
visual order). Contrast ≥ 4.5:1 for text. Hover/focus/active/disabled states on every control.
Offline banner + disabled network actions when offline. Reduced-motion respected. Layout holds
down to a narrow window (rail/inspector collapsible under ~1100px).

## Out of scope (YAGNI)

Drag-to-reposition zones, multi-select, undo history, front/back face toggle, pan. Zoom is the
only stage transform.
