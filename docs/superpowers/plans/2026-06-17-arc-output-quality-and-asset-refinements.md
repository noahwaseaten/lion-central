# Arc Output Quality & Asset Refinements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the arc output render at full device-pixel sharpness, give the media team an output alignment guide, gate the "Add" affordance behind selection, add per-logo crop to sponsors, and make the live-feed ticker handle simultaneous arrivals without glitching.

**Architecture:** The canvas compositor stays the single renderer; the fix is to make the *caller* (`useSurfaceCanvas` and the crop editor) size their backing store to displayed-size × `devicePixelRatio` and set a native→backing base transform, so painters are untouched. Sponsor content gains a per-item image transform (reusing the existing `drawTransformed`), selection grows a nullable component id so a surface can be selected on its own, and the feed ticker's glide generalizes from one row to a coalesced N-row batch with a snap path for huge bursts.

**Tech Stack:** Next.js (App Router), TypeScript (strict), React, Canvas 2D, Tailwind, shadcn/ui, Vitest. Commands: `pnpm exec vitest run <file>` (single test file), `pnpm typecheck`, `pnpm lint`.

---

## File Structure

**New files**
- `lib/arc/render/dpr.ts` — pure `backingSize()` helper (DPR + max-edge cap). + `dpr.test.ts`.
- `lib/arc/render/sponsor-layout.ts` — pure `sponsorGrid()` cell-rect helper. + `sponsor-layout.test.ts`.
- `lib/arc/content.test.ts` — `normalizeContent` sponsor `images → items` migration tests.
- `components/arc/output-guides.tsx` — DOM registration overlay + G-toggle + persistence.

**Modified**
- `lib/arc/content.ts` — `ImageTransform` type; sponsors `items`; `normalizeContent`/`defaultContent`.
- `lib/arc/layout-model.ts` — `Selection.id: string | null`; sponsors `items` in `sponsors()` helper.
- `lib/arc/presets.ts` — sponsors `items`; new "Sponsors populated" preset.
- `lib/arc/render/zones.ts` — `paintSponsors` per-item transform via `sponsorGrid` + `drawTransformed`.
- `lib/arc/render/feed-anim.ts` — variable-batch glide + huge-burst snap + coalescing. + extend `feed-anim.test.ts`.
- `hooks/use-surface-canvas.ts` — DPR backing store + base transform + `ResizeObserver`.
- `hooks/use-feed.ts` — rAF-coalesced snapshot application.
- `components/control/image-crop-editor.tsx` — DPR preview; refactor to `{ src, transform, aspect }`.
- `components/control/zone-content-editor.tsx` — image case + sponsor per-logo crop UI + copy.
- `components/control/logo-library.tsx` — copy cleanup.
- `components/arc/number-flow-clock.tsx` — `will-change-transform`.
- `components/arc/surface-output.tsx` — mount `OutputGuides`.
- `components/control/workspace/arc-stage.tsx` — surface select (click-vs-drag) + Add gating.
- `components/control/workspace/layers-panel.tsx` — header select + Add gating.
- `components/control/workspace/arc-workspace.tsx` — pass nullable selection through (no behavior change beyond types).

**Note on the breaking model change:** Task 4 changes `sponsors.images: string[]` → `sponsors.items`. Tasks 5–6 and the presets task depend on it. Do Task 4 fully (incl. `pnpm typecheck`) before the dependents.

---

## Task 1: DPR backing-size helper (pure)

**Files:**
- Create: `lib/arc/render/dpr.ts`
- Test: `lib/arc/render/dpr.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/arc/render/dpr.test.ts
import { describe, expect, it } from "vitest";

import { backingSize } from "./dpr";

describe("backingSize", () => {
  it("scales the displayed size by the device pixel ratio", () => {
    expect(backingSize(640, 128, 2)).toEqual({ w: 1280, h: 256 });
  });

  it("rounds to whole device pixels", () => {
    expect(backingSize(100.4, 50.6, 1)).toEqual({ w: 100, h: 51 });
  });

  it("never returns a zero dimension", () => {
    expect(backingSize(0, 0, 2)).toEqual({ w: 1, h: 1 });
  });

  it("caps the longest edge, preserving aspect", () => {
    // 3000 css * 2 dpr = 6000 → capped to 4096 on the long edge
    const r = backingSize(3000, 1500, 2, 4096);
    expect(Math.max(r.w, r.h)).toBe(4096);
    expect(r.w / r.h).toBeCloseTo(2, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/arc/render/dpr.test.ts`
Expected: FAIL — `backingSize` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/arc/render/dpr.ts
/**
 * Compute a canvas backing-store size from its displayed CSS size and the device
 * pixel ratio, so the canvas paints at true device resolution (no blur / "half
 * quality"). The longest edge is capped so extreme zoom can't allocate a huge
 * buffer; aspect ratio is preserved when capping.
 */
export function backingSize(
  cssW: number,
  cssH: number,
  dpr: number,
  maxEdge = 4096,
): { w: number; h: number } {
  let w = Math.max(1, Math.round(cssW * dpr));
  let h = Math.max(1, Math.round(cssH * dpr));
  const longest = Math.max(w, h);
  if (longest > maxEdge) {
    const k = maxEdge / longest;
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
  }
  return { w, h };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/arc/render/dpr.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/arc/render/dpr.ts lib/arc/render/dpr.test.ts
git commit -m "feat(render): add DPR-aware backing-size helper"
```

---

## Task 2: DPR-aware surface canvas (the crispness fix)

**Files:**
- Modify: `hooks/use-surface-canvas.ts`
- Modify: `lib/arc/render/compositor.ts` (doc comment only)

There is no DOM in vitest here, so this task is verified by typecheck + manual. The math it relies on is already covered by Task 1.

- [ ] **Step 1: Rewrite the canvas hook to size by DPR and set a base transform**

Replace the body of the `useEffect` in `hooks/use-surface-canvas.ts` (currently lines 24–41) with:

```ts
  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = getSurface(surfaceId);
    if (!canvas || !surface) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size the backing store to the canvas's real on-screen size × DPR, so the
    // surface paints at true device resolution at any zoom / on any display.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const { w, h } = backingSize(rect.width || surface.w, rect.height || surface.h, dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    const loop = (t: number) => {
      // Map native surface units onto the (DPR-scaled) backing store. drawComponent
      // save/restore preserves this base transform, so painters stay in native px.
      ctx.setTransform(canvas.width / surface.w, 0, 0, canvas.height / surface.h, 0, 0);
      drawSurface(ctx, surfaceId, inputsRef.current, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [surfaceId, canvasRef]);
```

- [ ] **Step 2: Add the import**

At the top of `hooks/use-surface-canvas.ts`, alongside the existing imports:

```ts
import { backingSize } from "@/lib/arc/render/dpr";
```

- [ ] **Step 3: Update the compositor doc comment**

In `lib/arc/render/compositor.ts`, change the line in the `drawSurface` doc block that reads:

```
 * `ctx` is expected to be sized to the surface's native dimensions. Components are
```

to:

```
 * `ctx` is expected to map native surface units onto its backing store — the caller
 * sets the base transform (see `useSurfaceCanvas`). Components are
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run `pnpm dev`, open `/` and zoom in on the stage, then open `/output/topbar` on the largest/HiDPI display available. Text and lines must be crisp (no blur, no "half quality").

- [ ] **Step 6: Commit**

```bash
git add hooks/use-surface-canvas.ts lib/arc/render/compositor.ts
git commit -m "fix(render): size surface canvas by devicePixelRatio for crisp output"
```

---

## Task 3: NumberFlow will-change

**Files:**
- Modify: `components/arc/number-flow-clock.tsx:29-32`

- [ ] **Step 1: Add the Tailwind will-change class**

In `components/arc/number-flow-clock.tsx`, change the clock container `className` (line ~30) from:

```tsx
        className="flex items-baseline font-extrabold leading-none tabular-nums"
```

to:

```tsx
        className="flex items-baseline font-extrabold leading-none tabular-nums will-change-transform"
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/arc/number-flow-clock.tsx
git commit -m "perf(clock): promote NumberFlow with will-change-transform"
```

---

## Task 4: ImageTransform + sponsors `items` model + migration (breaking)

**Files:**
- Modify: `lib/arc/content.ts`
- Modify: `lib/arc/layout-model.ts:65-72` (`sponsors` helper)
- Modify: `lib/arc/presets.ts:11-18` (`sponsorsGrid` helper)
- Test: `lib/arc/content.test.ts`

- [ ] **Step 1: Write the failing migration test**

```ts
// lib/arc/content.test.ts
import { describe, expect, it } from "vitest";

import { normalizeContent } from "./content";

describe("normalizeContent — sponsors items", () => {
  it("migrates legacy images: string[] to items with default transforms", () => {
    const out = normalizeContent({
      type: "sponsors",
      images: ["a.png", "b.png"],
      mode: "grid",
      intervalMs: 5000,
      columns: "auto",
      cellPadding: 0.12,
    });
    expect(out.type).toBe("sponsors");
    if (out.type !== "sponsors") return;
    expect(out.items).toEqual([
      { src: "a.png", fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null },
      { src: "b.png", fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null },
    ]);
  });

  it("keeps and back-fills already-migrated items", () => {
    const out = normalizeContent({
      type: "sponsors",
      items: [{ src: "x.png", scale: 2 }],
      mode: "rotate",
      intervalMs: 3000,
      columns: 3,
      cellPadding: 0.2,
    });
    if (out.type !== "sponsors") return;
    expect(out.items[0]).toEqual({
      src: "x.png", fit: "contain", scale: 2, offset: { x: 0, y: 0 }, padding: 0, background: null,
    });
    expect(out.mode).toBe("rotate");
    expect(out.columns).toBe(3);
  });

  it("drops non-string / src-less sponsor items", () => {
    const out = normalizeContent({ type: "sponsors", items: [{ scale: 2 }, "nope", { src: "ok.png" }] });
    if (out.type !== "sponsors") return;
    expect(out.items.map((i) => i.src)).toEqual(["ok.png"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/arc/content.test.ts`
Expected: FAIL — `items` is undefined / type still has `images`.

- [ ] **Step 3: Add the `ImageTransform` type and helpers in `content.ts`**

In `lib/arc/content.ts`, after the `Fit` type (line ~1), add:

```ts
/** Crop/place transform shared by image components and individual sponsor logos. */
export interface ImageTransform {
  fit: Fit;
  /** Multiplier on the fit baseline — 1 fits the frame, >1 zooms in / crops. */
  scale: number;
  /** Pan, as a fraction of the inner frame (0,0 = centered). */
  offset: { x: number; y: number };
  /** Inset, as a fraction of the frame's short edge (0–0.4). */
  padding: number;
  /** Solid fill behind the image (for white/transparent logos); null = none. */
  background: string | null;
}

/** One sponsor logo: a source plus its own crop/place transform. */
export interface SponsorItem extends ImageTransform {
  src: string;
}

/** A default (identity) transform: contain-fit, no zoom/pan/padding, no background. */
export function defaultTransform(): ImageTransform {
  return { fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null };
}
```

- [ ] **Step 4: Change the `sponsors` and `image` variants of `ZoneContent`**

Replace the `sponsors` member of the `ZoneContent` union (lines ~13-22) with:

```ts
  | {
      type: "sponsors";
      /** Per-logo source + crop transform; array order = grid / rotate order. */
      items: SponsorItem[];
      mode: "rotate" | "grid";
      intervalMs: number;
      /** Grid columns; "auto" picks near-square cells from the component aspect. */
      columns: number | "auto";
      /** Baseline inset per cell, as a fraction of the cell's short edge (0–0.4). */
      cellPadding: number;
    }
```

Replace the `image` member (lines ~23-35) with:

```ts
  | ({ type: "image"; src: string } & ImageTransform)
```

- [ ] **Step 5: Update `defaultContent` for sponsors and image**

In `defaultContent` (lines ~54-88), replace the `sponsors` case body with:

```ts
    case "sponsors":
      return {
        type: "sponsors",
        items: [],
        mode: "grid",
        intervalMs: 5000,
        columns: "auto",
        cellPadding: 0.12,
      };
```

and the `image` case body with:

```ts
    case "image":
      return { type: "image", src: "", ...defaultTransform() };
```

- [ ] **Step 6: Update `normalizeContent` for sponsors and image**

Add this helper above `normalizeContent` (near the `num` helper, line ~90):

```ts
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/** Coerce loose data into a complete ImageTransform, back-filling missing fields. */
function normalizeTransform(raw: Record<string, unknown>): ImageTransform {
  const off = (raw.offset ?? {}) as Record<string, unknown>;
  return {
    fit: raw.fit === "cover" ? "cover" : "contain",
    scale: Math.max(0.1, num(raw.scale, 1)),
    offset: { x: num(off.x, 0), y: num(off.y, 0) },
    padding: clampFrac(num(raw.padding, 0)),
    background: typeof raw.background === "string" ? raw.background : null,
  };
}
```

Replace the `sponsors` case in `normalizeContent` (lines ~118-126) with:

```ts
    case "sponsors": {
      // Accept new `items` or legacy `images: string[]`; both produce SponsorItem[].
      const rawItems = Array.isArray(c.items)
        ? c.items
        : Array.isArray(c.images)
          ? (c.images as unknown[]).map((src) => ({ src }))
          : [];
      const items: SponsorItem[] = rawItems
        .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>) : {}))
        .filter((it) => typeof it.src === "string" && it.src.length > 0)
        .map((it) => ({ src: str(it.src), ...normalizeTransform(it) }));
      return {
        type: "sponsors",
        items,
        mode: c.mode === "rotate" ? "rotate" : "grid",
        intervalMs: num(c.intervalMs, 5000),
        columns: c.columns === "auto" || c.columns === undefined ? "auto" : Math.max(1, num(c.columns, 1)),
        cellPadding: clampFrac(num(c.cellPadding, 0.12)),
      };
    }
```

Replace the `image` case in `normalizeContent` (lines ~127-138) with:

```ts
    case "image":
      return { type: "image", src: str(c.src), ...normalizeTransform(c) };
```

- [ ] **Step 7: Update the `SponsorItem`/`ImageTransform` exports**

At the bottom of `content.ts`, the `ZoneContent` / `ContentType` exports are already named exports; the new `ImageTransform`, `SponsorItem`, and `defaultTransform` are exported via their `export` keyword above. No extra export line needed.

- [ ] **Step 8: Update the `sponsors` helper in `layout-model.ts`**

Replace lines 65-72 (`const sponsors = …`) with:

```ts
const sponsors = (mode: "rotate" | "grid"): ZoneContent => ({
  type: "sponsors",
  items: [],
  mode,
  intervalMs: 5000,
  columns: "auto",
  cellPadding: 0.12,
});
```

- [ ] **Step 9: Update the `sponsorsGrid` helper in `presets.ts`**

Replace lines 11-18 (`const sponsorsGrid = …`) with:

```ts
const sponsorsGrid = (): ZoneContent => ({
  type: "sponsors",
  items: [],
  mode: "grid",
  intervalMs: 5000,
  columns: "auto",
  cellPadding: 0.12,
});
```

- [ ] **Step 10: Run the migration test**

Run: `pnpm exec vitest run lib/arc/content.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 11: Typecheck (find the `images` consumers to fix next)**

Run: `pnpm typecheck`
Expected: errors in `lib/arc/render/zones.ts` (`paintSponsors`) and `components/control/zone-content-editor.tsx` (`SponsorFields`) referencing `content.images`. These are fixed in Tasks 5 and 6 — leave them for now. (If you prefer a green build between tasks, do Tasks 5 and 6 before committing this; otherwise commit now and fix forward.)

- [ ] **Step 12: Commit**

```bash
git add lib/arc/content.ts lib/arc/content.test.ts lib/arc/layout-model.ts lib/arc/presets.ts
git commit -m "feat(content): per-logo sponsor items + shared ImageTransform with migration"
```

---

## Task 5: Sponsor grid layout helper + per-item painter

**Files:**
- Create: `lib/arc/render/sponsor-layout.ts`
- Test: `lib/arc/render/sponsor-layout.test.ts`
- Modify: `lib/arc/render/zones.ts` (`paintSponsors`, lines ~256-294)

- [ ] **Step 1: Write the failing layout test**

```ts
// lib/arc/render/sponsor-layout.test.ts
import { describe, expect, it } from "vitest";

import { sponsorColumns, sponsorGrid } from "./sponsor-layout";

describe("sponsorColumns", () => {
  it("auto-picks near-square cells from the component aspect", () => {
    // tall leg (1 wide, 5 tall) with 5 logos → a single column
    expect(sponsorColumns("auto", 5, 128, 640)).toBe(1);
  });

  it("clamps an explicit column count to the item count", () => {
    expect(sponsorColumns(6, 3, 100, 100)).toBe(3);
    expect(sponsorColumns(2, 4, 100, 100)).toBe(2);
  });
});

describe("sponsorGrid", () => {
  it("returns one evenly-spaced cell rect per item", () => {
    const cells = sponsorGrid(4, 200, 200, 2, 0); // 2x2, no gap
    expect(cells).toHaveLength(4);
    expect(cells[0]).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(cells[3]).toEqual({ x: 100, y: 100, w: 100, h: 100 });
  });

  it("applies an even gap between and around cells", () => {
    const [c0] = sponsorGrid(1, 100, 100, 1, 0.1); // gap = 10% of short edge = 10px
    expect(c0).toEqual({ x: 10, y: 10, w: 80, h: 80 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/arc/render/sponsor-layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure helper**

```ts
// lib/arc/render/sponsor-layout.ts
/** A cell rectangle within a sponsor component, in local px. */
export interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Resolve the column count for a grid: explicit (clamped to count) or near-square. */
export function sponsorColumns(
  columns: number | "auto",
  count: number,
  w: number,
  h: number,
): number {
  const n = Math.max(1, count);
  if (columns === "auto") {
    return Math.max(1, Math.min(n, Math.round(Math.sqrt((n * w) / h))));
  }
  return Math.max(1, Math.min(n, Math.round(columns)));
}

/**
 * Lay out `count` logos as an even grid in a `w × h` box. `gap` is a fraction of the
 * box's short edge, applied uniformly between and around cells, so a tall leg reads
 * as an evenly-spaced vertical stack (the designer reference look).
 */
export function sponsorGrid(
  count: number,
  w: number,
  h: number,
  cols: number,
  gap: number,
): Cell[] {
  const n = Math.max(0, count);
  if (n === 0) return [];
  const c = Math.max(1, cols);
  const rows = Math.ceil(n / c);
  const g = Math.max(0, gap) * Math.min(w, h);
  const cellW = (w - g * (c + 1)) / c;
  const cellH = (h - g * (rows + 1)) / rows;
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % c;
    const row = Math.floor(i / c);
    cells.push({
      x: g + col * (cellW + g),
      y: g + row * (cellH + g),
      w: Math.max(1, cellW),
      h: Math.max(1, cellH),
    });
  }
  return cells;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/arc/render/sponsor-layout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewrite `paintSponsors` to use the helper + per-item transform**

In `lib/arc/render/zones.ts`, add the import near the top (after the `feed-anim` import, line ~6):

```ts
import { sponsorColumns, sponsorGrid } from "./sponsor-layout";
```

Replace the entire `paintSponsors` function (lines ~256-294) with:

```ts
function paintSponsors(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: Extract<ZoneContent, { type: "sponsors" }>,
  tMs: number,
): void {
  const items = content.items.filter((it) => it.src);

  if (content.mode === "rotate") {
    if (items.length === 0) return placeholder(ctx, 8, 8, w - 16, h - 16, "SPONSOR");
    const interval = Math.max(800, content.intervalMs);
    const idx = Math.floor(tMs / interval) % items.length;
    const phase = (tMs % interval) / interval;
    const fade = Math.min(1, phase / 0.12); // quick fade-in each cycle
    ctx.globalAlpha = fade;
    const it = items[idx];
    const img = getImage(it.src);
    if (img && img.naturalWidth > 0) {
      if (it.background) {
        ctx.fillStyle = it.background;
        ctx.fillRect(0, 0, w, h);
      }
      drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, w, h, it);
    }
    ctx.globalAlpha = 1;
    return;
  }

  // Grid: equal, evenly-spaced cells, one logo each, each with its own transform.
  const count = items.length > 0 ? items.length : Math.max(1, Math.round(h / w));
  const cols = sponsorColumns(content.columns, count, w, h);
  const cells = sponsorGrid(count, w, h, cols, content.cellPadding);

  for (let i = 0; i < count; i++) {
    const cell = cells[i];
    const it = items[i];
    if (!it) {
      placeholder(ctx, cell.x, cell.y, cell.w, cell.h, "LOGO");
      continue;
    }
    if (it.background) {
      ctx.fillStyle = it.background;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    }
    const img = getImage(it.src);
    if (img && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(cell.x, cell.y);
      drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, cell.w, cell.h, it);
      ctx.restore();
    } else {
      placeholder(ctx, cell.x, cell.y, cell.w, cell.h, "LOGO");
    }
  }
}
```

(`cellPadding` now feeds the even `gap`; per-item `padding` still applies inside each cell via `drawTransformed`.)

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: only the remaining `SponsorFields` error in `zone-content-editor.tsx` (fixed in Task 6). `zones.ts` is now clean.

- [ ] **Step 7: Commit**

```bash
git add lib/arc/render/sponsor-layout.ts lib/arc/render/sponsor-layout.test.ts lib/arc/render/zones.ts
git commit -m "feat(render): per-logo sponsor transforms + even-gap grid"
```

---

## Task 6: Per-logo crop UI (reusable editor + sponsor fields) + copy

**Files:**
- Modify: `components/control/image-crop-editor.tsx`
- Modify: `components/control/zone-content-editor.tsx` (image case + `SponsorFields`)
- Modify: `components/control/logo-library.tsx:51-53` (copy)

This is UI; verified by typecheck + manual.

- [ ] **Step 1: Refactor `ImageCropEditor` to operate on a transform + src (DPR preview)**

In `components/control/image-crop-editor.tsx`, change the imports and component signature. Replace the `ImageContent` type alias (line ~12) and the component props (lines ~27-45) with a transform-based API:

```tsx
import type { ImageTransform } from "@/lib/arc/content";

// (remove: type ImageContent = Extract<ZoneContent, { type: "image" }>)

export function ImageCropEditor({
  src,
  transform,
  aspect,
  onChange,
  onSrcChange,
}: {
  src: string;
  transform: ImageTransform;
  aspect: number;
  /** Update the transform (zoom/pan/fit/padding/background). */
  onChange: (next: ImageTransform) => void;
  /** Update the source URL (omit to hide the URL field + library, e.g. for sponsor items). */
  onSrcChange?: (src: string) => void;
}) {
```

Throughout the component body, replace `content` with `transform` and `content.src` with `src`. Specifically:
- `contentRef.current = content` → `contentRef.current = transform` and `const contentRef = useRef(transform);`
- In the draw loop, `const c = contentRef.current;` then `c.background`, `getImage(src)`, and `drawTransformed(ctx, img, …, c)` (use `src` for the image, `c` for the transform).
- `onChange({ ...content, … })` → `onChange({ ...transform, … })` everywhere.
- `reset(patch)` → `onChange({ ...transform, scale: 1, offset: { x: 0, y: 0 }, ...patch })`.
- Replace the `<SrcField content={content} onChange={onChange} />` usage with a conditional URL field driven by `onSrcChange` (see Step 3).

- [ ] **Step 2: Make the preview canvas DPR-aware**

In the draw-loop `useEffect` of `ImageCropEditor`, set the backing store to `w·dpr × h·dpr` and scale the context. Replace the canvas element (lines ~154-165) so its backing store differs from its CSS size:

```tsx
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ width: w, height: h }}
          className={`touch-none rounded-md border border-input ${src ? "cursor-grab active:cursor-grabbing" : ""}`}
          aria-label="Image crop preview — drag to pan, scroll to zoom"
        />
```

and update the draw loop to size + scale by DPR, drawing in logical `w/h` units:

```tsx
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    let raf = 0;
    const loop = () => {
      const c = contentRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      paintChecker(ctx, w, h);
      if (c.background) {
        ctx.fillStyle = c.background;
        ctx.fillRect(0, 0, w, h);
      }
      const img = getImage(src);
      if (img && img.naturalWidth > 0) {
        drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, w, h, c);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [w, h, src]);
```

(The wheel handler already reads `canvas.getBoundingClientRect()` for cursor math, so it stays correct — it works in CSS px.)

- [ ] **Step 3: Add an optional URL field + library, gated on `onSrcChange`**

Remove the `SrcField` sub-component and its `LogoLibrary` usage from `image-crop-editor.tsx` (the picker now lives where the editor is used). At the top of the returned JSX, replace `<SrcField … />` with:

```tsx
      {onSrcChange && (
        <input
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          value={src.startsWith("data:") ? "" : src}
          placeholder={src.startsWith("data:") ? "(uploaded image)" : "https://… image URL"}
          onChange={(e) => onSrcChange(e.target.value)}
          aria-label="Image URL"
        />
      )}
```

Remove the now-unused `LogoLibrary` import from this file (it moves to `zone-content-editor.tsx`). Also delete the `"Drag to pan · scroll to zoom"` caption `<p>` (lines ~166-168) — redundant with the canvas `aria-label` (copy cleanup).

- [ ] **Step 4: Update the image case in `ZoneFields`**

In `components/control/zone-content-editor.tsx`, add the `LogoLibrary` import at the top (it already imports it) and change the `image` case (line ~41-42) to feed the new API and keep the library picker:

```tsx
    case "image":
      return (
        <div className="flex flex-col gap-3">
          <ImageCropEditor
            src={content.src}
            transform={content}
            aspect={aspect}
            onChange={(t) => onChange({ ...content, ...t })}
            onSrcChange={(src) => onChange({ ...content, src })}
          />
          <LogoLibrary
            onPick={(url) => onChange({ ...content, src: content.src === url ? "" : url })}
            selected={content.src ? [content.src] : []}
          />
        </div>
      );
```

- [ ] **Step 5: Rewrite `SponsorFields` for per-logo items + crop**

Replace the entire `SponsorFields` function in `zone-content-editor.tsx` (lines ~87-186) with a version that lists each logo and expands its crop editor. Add `useState` to the file's React import and import the transform + `componentPixelSize` helpers:

```tsx
import { useState } from "react";

import { ImageCropEditor } from "@/components/control/image-crop-editor";
import { LogoLibrary } from "@/components/control/logo-library";
import { defaultTransform, type Fit, type ImageTransform, type SponsorItem, type ZoneContent } from "@/lib/arc/content";
```

```tsx
function SponsorFields({
  content,
  onChange,
  aspect,
}: {
  content: Extract<ZoneContent, { type: "sponsors" }>;
  onChange: (next: ZoneContent) => void;
  aspect: number;
}) {
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const srcs = content.items.map((i) => i.src);

  // Toggle a logo's membership; new logos get a default transform.
  const toggle = (url: string) => {
    const has = srcs.includes(url);
    const items: SponsorItem[] = has
      ? content.items.filter((i) => i.src !== url)
      : [...content.items, { src: url, ...defaultTransform() }];
    onChange({ ...content, items });
  };

  const patchItem = (src: string, t: ImageTransform) =>
    onChange({
      ...content,
      items: content.items.map((i) => (i.src === src ? { ...i, ...t } : i)),
    });

  // Each cell's aspect ≈ component aspect ÷ columns-vs-rows; component aspect is a
  // good-enough preview ratio for per-logo cropping.
  const cellAspect = aspect;

  return (
    <div className="flex flex-col gap-3">
      <Field label="Mode">
        <select
          className={inputCls}
          value={content.mode}
          onChange={(e) => onChange({ ...content, mode: e.target.value as "rotate" | "grid" })}
        >
          <option value="grid">Grid (squares, all at once)</option>
          <option value="rotate">Rotate (one at a time)</option>
        </select>
      </Field>

      {content.mode === "grid" ? (
        <div className="flex gap-3">
          <Field label="Columns">
            <select
              className={inputCls}
              value={content.columns === "auto" ? "auto" : String(content.columns)}
              onChange={(e) =>
                onChange({
                  ...content,
                  columns: e.target.value === "auto" ? "auto" : Number(e.target.value),
                })
              }
            >
              <option value="auto">Auto</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gap">
            <input
              type="number"
              min={0}
              max={40}
              step={1}
              className={inputCls}
              value={Math.round(content.cellPadding * 100)}
              onChange={(e) =>
                onChange({
                  ...content,
                  cellPadding: Math.min(0.4, Math.max(0, (Number(e.target.value) || 0) / 100)),
                })
              }
            />
          </Field>
        </div>
      ) : (
        <Field label="Rotate interval (seconds)">
          <input
            type="number"
            min={1}
            step={1}
            className={inputCls}
            value={Math.round(content.intervalMs / 1000)}
            onChange={(e) =>
              onChange({ ...content, intervalMs: Math.max(1, Number(e.target.value) || 1) * 1000 })
            }
          />
        </Field>
      )}

      <LogoLibrary onPick={toggle} selected={srcs} />

      {content.items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {content.items.length} logo{content.items.length === 1 ? "" : "s"} — click to crop
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...content, items: [] })}
              className="rounded px-1.5 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </button>
          </div>

          {content.items.map((item) => (
            <div key={item.src} className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setOpenSrc((s) => (s === item.src ? null : item.src))}
                aria-expanded={openSrc === item.src}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logo, not a build asset */}
                <img src={item.src} alt="" className="size-6 shrink-0 rounded object-contain" />
                <span className="flex-1 truncate text-muted-foreground">{item.src.split("/").pop()}</span>
              </button>
              {openSrc === item.src && (
                <div className="border-t border-border p-2">
                  <ImageCropEditor
                    src={item.src}
                    transform={item}
                    aspect={cellAspect}
                    onChange={(t) => patchItem(item.src, t)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Pass `aspect` from `ZoneFields` into `SponsorFields`**

In `ZoneFields`, change the sponsors case (line ~39-40) to forward `aspect`:

```tsx
    case "sponsors":
      return <SponsorFields content={content} onChange={onChange} aspect={aspect} />;
```

- [ ] **Step 7: Clean up the logo-library empty-state copy**

In `components/control/logo-library.tsx`, change the empty-state text (lines ~51-53) from:

```tsx
          No logos yet. Upload PNGs once — they’re saved on the server and available everywhere.
```

to:

```tsx
          No logos yet.
```

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 9: Manual check**

`pnpm dev`: select a sponsors component, add two logos, click one to crop (drag to pan, scroll to zoom), confirm the grid updates and the per-logo background works. Select a standalone image and confirm its editor + library still work.

- [ ] **Step 10: Commit**

```bash
git add components/control/image-crop-editor.tsx components/control/zone-content-editor.tsx components/control/logo-library.tsx
git commit -m "feat(sponsors): per-logo crop editor; reuse crop editor for images; trim copy"
```

---

## Task 7: Surface selection + conditional Add

**Files:**
- Modify: `lib/arc/layout-model.ts:13-17` (`Selection`)
- Modify: `components/control/workspace/arc-stage.tsx`
- Modify: `components/control/workspace/layers-panel.tsx`
- Modify: `components/control/workspace/arc-surface.tsx` (add `data-surface`)

- [ ] **Step 1: Make the component id nullable**

In `lib/arc/layout-model.ts`, change the `Selection` interface (lines 13-17) to:

```ts
/** A selection: a surface, optionally a specific component on it (id null = the surface itself). */
export interface Selection {
  surface: SurfaceId;
  id: string | null;
}
```

- [ ] **Step 2: Typecheck to find consumers**

Run: `pnpm typecheck`
Expected: errors where `selected.id` is assumed a string (e.g. `arc-stage.tsx` key compares, `zone-inspector.tsx` `find`). `zone-inspector`'s `find((c) => c.id === selected.id)` returns `undefined` for `id: null` → it already renders `EmptyState`, which is the desired "surface selected, no component" view; no change needed there. Fix the stage in the next steps.

- [ ] **Step 3: Tag each surface with `data-surface` in `arc-surface.tsx`**

In `components/control/workspace/arc-surface.tsx`, add `data-surface={surfaceId}` to the wrapper `div` (line ~33):

```tsx
    <div className="absolute" data-surface={surfaceId} style={{ ...style, width: cssW, height: cssH }}>
```

- [ ] **Step 4: Select a surface on click (vs. drag) in `arc-stage.tsx`**

In `components/control/workspace/arc-stage.tsx`, replace the `onPointerDown` handler (lines ~187-202) with a version that records a candidate surface and discriminates click from drag:

```tsx
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!view) return;
    const target = e.target as HTMLElement;
    const onControl = target.closest("[data-component],[data-stage-control]");
    const surfaceEl = target.closest<HTMLElement>("[data-surface]");
    const wantsPan = e.button === 1 || spaceHeld || !onControl;
    if (!wantsPan) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture unavailable — panning still works without it
    }
    pan.current = {
      x: e.clientX,
      y: e.clientY,
      tx: view.tx,
      ty: view.ty,
      // remember what to select if this turns out to be a click, not a drag
      surface: !onControl && e.button === 0 && !spaceHeld
        ? ((surfaceEl?.dataset.surface as SurfaceId | undefined) ?? null)
        : undefined,
      moved: false,
    };
    setPanning(true);
  };
```

Update the `pan` ref type (line ~185) to carry the candidate:

```tsx
  const pan = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    surface?: SurfaceId | null;
    moved: boolean;
  } | null>(null);
```

In `onPointerMove` (lines ~203-209), mark a real drag once past a small threshold:

```tsx
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) > 4) p.moved = true;
    setView((v) => (v ? { ...v, tx: p.tx + dx, ty: p.ty + dy } : v));
  };
```

In `endPan` (lines ~210-219), apply the click selection when it wasn't a drag:

```tsx
  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    if (!p.moved && p.surface !== undefined) {
      // a plain click on empty space: select that surface, or clear on the backdrop
      onSelect(p.surface ? { surface: p.surface, id: null } : null);
    }
    pan.current = null;
    setPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  };
```

- [ ] **Step 5: Gate the floating Add to the active surface**

Still in `arc-stage.tsx`, the per-surface overlay block renders `AddComponentMenu` for every surface. Compute the active surface and render Add only for it. In the `{SURFACES.map((surface) => { … })}` overlay block (lines ~276-342), wrap the `<AddComponentMenu …>` (lines ~298-313) in a condition:

```tsx
                  {selected?.surface === surface.id && (
                    <AddComponentMenu
                      align="start"
                      onAdd={(type) => addComponent(surface.id, type)}
                      trigger={
                        <button
                          type="button"
                          data-stage-control
                          aria-label={`Add component to ${surface.label}`}
                          className="absolute z-40 flex items-center gap-1 rounded-md border border-border bg-popover/95 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
                          style={{ left: p.x * view.scale, top: p.y * view.scale - 22 }}
                        >
                          <Plus weight="bold" className="size-3" />
                          Add
                        </button>
                      }
                    />
                  )}
```

- [ ] **Step 6: Gate the layers-panel Add to the active surface + select on header click**

In `components/control/workspace/layers-panel.tsx`, make the surface header a button that selects the surface, and show the `+` only when that surface is active. Replace the header block (lines ~41-58) with:

```tsx
            <div className="flex items-center justify-between px-1.5">
              <button
                type="button"
                onClick={() => onSelect({ surface: surface.id, id: null })}
                className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {surface.label}
              </button>
              {selected?.surface === surface.id && (
                <AddComponentMenu
                  align="end"
                  onAdd={(type) => addComponent(surface.id, type)}
                  trigger={
                    <button
                      type="button"
                      aria-label={`Add component to ${surface.label}`}
                      className="grid size-5 place-items-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus weight="bold" className="size-3.5" />
                    </button>
                  }
                />
              )}
            </div>
```

`layers-panel.tsx`'s `onSelect` prop is typed `(sel: Selection) => void` — it already accepts the nullable-id shape now. The `h2` becomes a `<button>`; remove the now-unused `h2` if your linter flags it (it's replaced above).

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (`SurfaceId` is already imported in `arc-stage.tsx`.)

- [ ] **Step 8: Manual check**

`pnpm dev`: on load no "Add" chips show. Click empty space on the top bar → its Add chip appears; click a component → component selected; click the dark backdrop → all clear. In the layers panel, clicking a surface label reveals its `+`.

- [ ] **Step 9: Commit**

```bash
git add lib/arc/layout-model.ts components/control/workspace/arc-stage.tsx components/control/workspace/layers-panel.tsx components/control/workspace/arc-surface.tsx
git commit -m "feat(workspace): surface selection; show Add only for the active surface"
```

---

## Task 8: Output alignment guide (registration overlay)

**Files:**
- Create: `components/arc/output-guides.tsx`
- Modify: `components/arc/surface-output.tsx`

- [ ] **Step 1: Create the registration overlay component**

```tsx
// components/arc/output-guides.tsx
"use client";

import { useEffect, useState } from "react";

const KEY = "lion-central.output-guides";

/**
 * A toggle-able registration overlay for an /output surface: a high-contrast border
 * on the exact surface rectangle, corner crop marks, a center crosshair, and a
 * dimension readout — so the media team can center/map the surface onto the arc.
 * Rendered as a DOM overlay (never into the canvas), so it can't leak into the LED
 * feed. Press G to toggle; state persists. Default on.
 */
export function OutputGuides({ label, w, h }: { label: string; w: number; h: number }) {
  const [on, setOn] = useState(true);
  const [idle, setIdle] = useState(false);

  // Restore persisted on/off once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) setOn(saved === "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  // G toggles; persist the choice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "g") return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      setOn((v) => {
        const next = !v;
        try {
          localStorage.setItem(KEY, next ? "1" : "0");
        } catch {
          // ignore
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-hide the corner button when the mouse is idle.
  useEffect(() => {
    let t = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener("pointermove", wake);
    wake();
    return () => {
      window.removeEventListener("pointermove", wake);
      window.clearTimeout(t);
    };
  }, []);

  const C = "#ff2d95";

  return (
    <div className="pointer-events-none absolute inset-0">
      {on && (
        <>
          {/* exact-rectangle border */}
          <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 2px ${C}` }} />
          {/* center crosshair */}
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ background: C, opacity: 0.5 }} />
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: C, opacity: 0.5 }} />
          {/* corner crop marks */}
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <div
              key={c}
              className="absolute"
              style={{
                width: 18,
                height: 18,
                [c.includes("l") ? "left" : "right"]: -1,
                [c.includes("t") ? "top" : "bottom"]: -1,
                borderTop: c.includes("t") ? `3px solid ${C}` : undefined,
                borderBottom: c.includes("b") ? `3px solid ${C}` : undefined,
                borderLeft: c.includes("l") ? `3px solid ${C}` : undefined,
                borderRight: c.includes("r") ? `3px solid ${C}` : undefined,
              }}
            />
          ))}
          {/* dimension readout */}
          <div
            className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-xs font-bold"
            style={{ color: "#fff", background: C }}
          >
            {label} · {w}×{h}
          </div>
        </>
      )}
      {/* toggle button */}
      <button
        type="button"
        onClick={() => {
          setOn((v) => {
            const next = !v;
            try {
              localStorage.setItem(KEY, next ? "1" : "0");
            } catch {
              // ignore
            }
            return next;
          });
        }}
        className="pointer-events-auto absolute left-2 top-2 rounded-md border border-white/30 bg-black/60 px-2 py-1 text-xs font-medium text-white outline-none transition-opacity hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white"
        style={{ opacity: idle ? 0 : 1 }}
        aria-label={on ? "Hide alignment guides (G)" : "Show alignment guides (G)"}
      >
        {on ? "Guides on (G)" : "Guides off (G)"}
      </button>
    </div>
  );
}
```

(Inline styles are used here intentionally — this is rendered display output / an alignment tool, the same documented exception the canvas painters use, not control-panel UI.)

- [ ] **Step 2: Mount the overlay in the output**

In `components/arc/surface-output.tsx`, import and render `OutputGuides` inside the `relative` wrapper (after the existing `SurfaceClockOverlay`, line ~34):

```tsx
import { OutputGuides } from "./output-guides";
```

```tsx
        <SurfaceClockOverlay
          surfaceId={surfaceId}
          inputs={inputs}
          displayW={surface.w}
          displayH={surface.h}
        />
        <OutputGuides label={surface.label} w={surface.w} h={surface.h} />
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Manual check**

`pnpm dev`, open `/output/leg-left`: the registration overlay shows by default; press **G** to hide it; reload and confirm the choice persisted; the corner button fades when the mouse is idle.

- [ ] **Step 5: Commit**

```bash
git add components/arc/output-guides.tsx components/arc/surface-output.tsx
git commit -m "feat(output): toggle-able registration alignment overlay (G)"
```

---

## Task 9: Smart-batch feed animation

**Files:**
- Modify: `lib/arc/render/feed-anim.ts`
- Test: `lib/arc/render/feed-anim.test.ts` (extend)

- [ ] **Step 1: Write the failing batch/snap tests (append to the existing describe block)**

Add these `it` blocks inside the `describe("tickerRows", …)` in `lib/arc/render/feed-anim.test.ts`:

```ts
  it("batches simultaneous arrivals into one glide (both new rows fade in together)", () => {
    const c = freshCanvas();
    tickerRows(c, "k", [e("1")], 3, 300, 0);
    tickerRows(c, "k", [e("1")], 3, 300, 1000); // settled

    // two athletes arrive at once
    const start = tickerRows(c, "k", [e("3"), e("2"), e("1")], 3, 300, 1000);
    expect(start.find((r) => r.entry.id === "2")!.alpha).toBe(0);
    expect(start.find((r) => r.entry.id === "3")!.alpha).toBe(0);

    const end = tickerRows(c, "k", [e("3"), e("2"), e("1")], 3, 300, 1760);
    const byId = Object.fromEntries(end.map((r) => [r.entry.id, r]));
    expect(byId["2"].alpha).toBe(1);
    expect(byId["3"].alpha).toBe(1);
    expect(byId["3"].y).toBeCloseTo(200); // newest at the bottom
    expect(byId["2"].y).toBeCloseTo(100);
  });

  it("snaps instantly when a burst is larger than the visible window", () => {
    const c = freshCanvas();
    tickerRows(c, "k", [e("1")], 2, 200, 0);
    tickerRows(c, "k", [e("1")], 2, 200, 1000); // settled, rows=2

    // 4 new arrive at once (> 2 rows) → snap, no mid-glide fade
    const snap = tickerRows(c, "k", [e("5"), e("4"), e("3"), e("2"), e("1")], 2, 200, 1000);
    const ids = snap.map((r) => r.entry.id).sort();
    expect(ids).toEqual(["4", "5"]); // jumped straight to the latest two
    expect(snap.every((r) => r.alpha === 1)).toBe(true); // no glide
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run lib/arc/render/feed-anim.test.ts`
Expected: FAIL on the new cases (current code only glides one row).

- [ ] **Step 3: Add `shiftRows` to the state and generalize the glide**

In `lib/arc/render/feed-anim.ts`, add a field to `TickerState` (after `glideStart`, line ~30):

```ts
  /** How many rows the current glide moves (1 normally; a batch on simultaneous arrivals). */
  shiftRows: number;
```

Update the initial state in `stateFor` (line ~43) to include it:

```ts
    st = { order: [], byId: new Map(), firstSeen: new Map(), newestId: null, glideStart: 0, shiftRows: 0 };
```

Replace the block from `// A change in the newest id …` through the end of `tickerRows` (lines ~109-153) with:

```ts
  // A change in the newest id means the file gained one or more lines.
  const newest = st.order[n - 1];
  if (newest !== st.newestId) {
    const prevIdx = st.newestId ? st.order.indexOf(st.newestId) : -1;
    // How many genuinely-new ids arrived since the last settled newest. On first
    // sight (or if the previous newest scrolled out of history), treat all as new.
    const newCount = prevIdx >= 0 ? n - 1 - prevIdx : n;
    st.newestId = newest;
    st.glideStart = now;
    st.shiftRows = Math.max(1, newCount);
  }

  // A burst bigger than the window snaps instantly (no glide); otherwise ease.
  const snap = st.shiftRows > rows;
  const p =
    prefersReducedMotion() || st.glideStart === 0 || snap
      ? 1
      : easeInOut(clamp01((now - st.glideStart) / TRANSITION_MS));

  const rowH = h / rows;
  const shift = (1 - p) * st.shiftRows * rowH; // column starts shiftRows lower, rises to rest
  const count = Math.min(n, rows);
  const extra = p < 1 ? Math.min(st.shiftRows, n - count) : 0; // rows leaving off the top
  const firstNewIdx = n - st.shiftRows; // ids at/after this index are the new arrivals
  const freshOf = (id: string) => clamp01(1 - (now - (st.firstSeen.get(id) ?? now)) / FRESH_MS);

  const out: TickerRow[] = [];
  const rendered = count + extra;
  for (let r = 0; r < rendered; r++) {
    const idx = n - rendered + r;
    if (idx < 0) continue;
    const id = st.order[idx];
    const entry = st.byId.get(id);
    if (!entry) continue;
    const slot = rows - count + (r - extra); // negative slots are leaving rows above the top
    const incoming = idx >= firstNewIdx; // a just-arrived row fades in
    const alpha = slot < 0 ? clamp01(1 - p) : incoming ? clamp01(p) : 1;
    out.push({ entry, y: slot * rowH + shift, alpha, fresh: freshOf(id) });
  }

  return out;
```

- [ ] **Step 4: Run the full feed-anim suite**

Run: `pnpm exec vitest run lib/arc/render/feed-anim.test.ts`
Expected: PASS — the new batch/snap tests **and** all pre-existing tests (single-row glide, overflow fade, static-between-appends).

- [ ] **Step 5: Commit**

```bash
git add lib/arc/render/feed-anim.ts lib/arc/render/feed-anim.test.ts
git commit -m "feat(feed): batch simultaneous arrivals; snap huge bursts"
```

---

## Task 10: Coalesce feed snapshots (no render storm under load)

**Files:**
- Modify: `hooks/use-feed.ts`

Verified by typecheck + manual (rAF/DOM behavior, not unit-tested here).

- [ ] **Step 1: Buffer snapshots and apply at most once per animation frame**

In `hooks/use-feed.ts`, inside the main `useEffect` (after the `let fallbackTimer …` declarations, line ~55), add an rAF-coalescing buffer and rewrite `applySnapshot`:

```ts
    let pending: { snap: FeedSnapshot; polling: boolean } | null = null;
    let flushRaf = 0;

    const flush = () => {
      flushRaf = 0;
      if (cancelled || !pending) return;
      const { snap, polling } = pending;
      pending = null;
      haveData.current = true;
      setRaw(snap.entries);
      setStatus(snap.entries.length === 0 ? "empty" : polling ? "polling" : "live");
    };

    const applySnapshot = (snap: FeedSnapshot, polling: boolean) => {
      if (cancelled) return;
      // Keep only the latest snapshot and apply once per frame, so a burst of SSE
      // frames can't trigger a React render storm.
      pending = { snap, polling };
      if (!flushRaf) flushRaf = requestAnimationFrame(flush);
    };
```

- [ ] **Step 2: Cancel the pending frame on cleanup**

In the same effect's cleanup `return` (lines ~127-132), add the rAF cancel:

```ts
    return () => {
      cancelled = true;
      es?.close();
      stopPolling();
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (flushRaf) cancelAnimationFrame(flushRaf);
    };
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Manual check**

`pnpm dev` with a feed file configured; click the toolbar "append" button rapidly (or run several `POST /api/feed/append` in a tight loop) and confirm the ticker stays smooth — one clean batch glide, no flicker or stutter.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-feed.ts
git commit -m "perf(feed): coalesce snapshots to one update per frame"
```

---

## Task 11: "Sponsors populated" preset

**Files:**
- Modify: `lib/arc/presets.ts`

- [ ] **Step 1: Add a layout preset matching the designer reference**

In `lib/arc/presets.ts`, add a `sponsorsPopulated()` builder and register it. After the `feedOff()` function (line ~27), add:

```ts
import { makeComponent } from "./layout-model";
import { SHOULDER_W, TOP_BAR } from "./layout";

const SHOULDER_FRAC = SHOULDER_W / TOP_BAR.w; // ≈ 0.246

/**
 * "Sponsors populated" — the designer reference arrangement: shoulder sponsor stacks
 * + a center title/clock band on the top bar, and a vertical sponsor stack on each
 * leg. Ships the layout structure with empty sponsor grids; the operator fills logos
 * from the shared library.
 */
function sponsorsPopulated(): ArcConfig {
  const c = defaultConfig();
  c.surfaces.topbar = [
    makeComponent(sponsorsGrid(), { x: 0, y: 0, w: SHOULDER_FRAC, h: 1 }, "Left shoulder"),
    makeComponent(
      { type: "text", title: "Olympic Cross Triathlon", subtitle: "" },
      { x: SHOULDER_FRAC, y: 0, w: 1 - SHOULDER_FRAC * 2, h: 1 },
      "Title",
    ),
    makeComponent(sponsorsGrid(), { x: 1 - SHOULDER_FRAC, y: 0, w: SHOULDER_FRAC, h: 1 }, "Right shoulder"),
  ];
  c.surfaces["leg-left"] = [makeComponent(sponsorsGrid(), { x: 0, y: 0, w: 1, h: 1 }, "Left sponsors")];
  c.surfaces["leg-right"] = [makeComponent(sponsorsGrid(), { x: 0, y: 0, w: 1, h: 1 }, "Right sponsors")];
  return c;
}
```

Note: the existing `import { type ArcConfig, defaultConfig, makeComponent } from "./layout-model";` at the top already imports `makeComponent` — if so, do not duplicate the import; only add the `./layout` import. Adjust the import lines to avoid duplicates:

```ts
import { SHOULDER_W, TOP_BAR } from "./layout";
import { type ArcConfig, defaultConfig, makeComponent } from "./layout-model";
```

- [ ] **Step 2: Register the preset**

Replace the `BUILTIN_PRESETS` array (lines ~30-33) with:

```ts
export const BUILTIN_PRESETS: Preset[] = [
  { id: "builtin:live-feed", name: "Live feed", config: defaultConfig() },
  { id: "builtin:feed-off", name: "Feed off", config: feedOff() },
  { id: "builtin:sponsors-populated", name: "Sponsors populated", config: sponsorsPopulated() },
];
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Manual check**

`pnpm dev`: open the presets menu, apply "Sponsors populated", confirm the shoulder + center-title + two leg-stack layout appears with empty sponsor grids ready to fill.

- [ ] **Step 5: Commit**

```bash
git add lib/arc/presets.ts
git commit -m "feat(presets): add Sponsors populated reference layout"
```

---

## Task 12: Final copy sweep + full verification

**Files:**
- Modify: `components/control/zone-content-editor.tsx` (Hint review) and any remaining redundant microcopy found.

- [ ] **Step 1: Review remaining helper text**

Grep the control panel for narrating microcopy and trim text that only restates the visible. Run:

Run: `git grep -n "saved on the server\|available everywhere\|scroll to zoom\|drag to pan" -- components/`
Expected: no matches (already removed in Tasks 6). If any remain, remove them.

Keep genuinely instructive hints (e.g. the NumberFlow `Hint` "Smoothly rolls the digits… Timing is set in 'Race clock'." explains a non-obvious dependency — leave it).

- [ ] **Step 2: Run the full test suite**

Run: `pnpm exec vitest run`
Expected: PASS — `dpr`, `content`, `sponsor-layout`, `feed-anim`, `layout-model`, `snapping` suites all green.

- [ ] **Step 3: Typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all succeed.

- [ ] **Step 4: Commit (only if Step 1 changed files)**

```bash
git add -A
git commit -m "chore(ui): final redundant-copy sweep"
```

---

## Self-Review

**Spec coverage:**
- §1 DPR crisp rendering → Tasks 1, 2 (surface canvas) + Task 6 Step 2 (crop editor). ✓
- §1 NumberFlow will-change → Task 3. ✓
- §2 Output alignment guide (option C registration + G toggle + persist) → Task 8. ✓
- §3 Conditional Add + surface selection → Task 7. ✓
- §4 Per-asset crop (ImageTransform, sponsors items, migration, painter, UI) → Tasks 4, 5, 6. ✓
- §5 Dimensions unchanged + even-gap grid + populated preset → Task 5 (grid) + Task 11 (preset); no `layout.ts` change (correct). ✓
- §6 Smart-batch feed motion + coalescing → Tasks 9, 10. ✓
- §7 Copy cleanup → Task 6 Step 7, Task 12. ✓

**Type consistency:** `ImageTransform`/`SponsorItem`/`defaultTransform` defined in Task 4 are used identically in Tasks 5 (`drawTransformed(…, it)`), 6 (`transform`/`onChange`), 11. `Selection.id: string | null` (Task 7) is consumed by stage/layers/inspector without contradiction. `backingSize` (Task 1) signature matches its use in Tasks 2 & 6. `sponsorColumns`/`sponsorGrid` (Task 5) match their `zones.ts` call. `shiftRows` added and initialized together (Task 9).

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. Task 4 Step 11 intentionally documents a transient typecheck error with the exact files and the tasks that resolve it (fix-forward), not a placeholder.
