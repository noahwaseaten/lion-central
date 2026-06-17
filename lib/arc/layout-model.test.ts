import { describe, expect, it } from "vitest";

import { clampRect, defaultConfig, migrate, normalizeComponent } from "./layout-model";

describe("migrate", () => {
  it("returns the default layout for empty / junk input", () => {
    expect(migrate(null).surfaces.topbar.length).toBeGreaterThan(0);
    expect(migrate(42).surfaces.clock.length).toBe(1);
    // Component ids are random, so compare structure (types + rects), not ids.
    const types = (c: { content: { type: string } }[]) => c.map((x) => x.content.type);
    expect(types(migrate({}).surfaces.topbar)).toEqual(types(defaultConfig().surfaces.topbar));
  });

  it("converts a legacy zone config to components, dropping brand", () => {
    const legacy = {
      background: "#101010",
      zones: {
        "clock-main": { type: "clock" },
        "shoulder-left": { type: "sponsors", images: [], mode: "rotate", intervalMs: 5000 },
        brand: { type: "brand", tagline: "X" },
        feed: { type: "feed" },
        "shoulder-right": { type: "sponsors", images: [], mode: "rotate", intervalMs: 5000 },
        "leg-left-panel": { type: "sponsors", images: [], mode: "grid", intervalMs: 6000 },
        "leg-right-panel": { type: "sponsors", images: [], mode: "grid", intervalMs: 6000 },
      },
    };
    const cfg = migrate(legacy);
    expect(cfg.background).toBe("#101010");
    // brand dropped → top bar has shoulders + feed, no brand component
    const types = cfg.surfaces.topbar.map((c) => c.content.type);
    expect(types).not.toContain("brand");
    expect(types).toContain("feed");
    expect(cfg.surfaces.topbar).toHaveLength(3);
    expect(cfg.surfaces.clock).toHaveLength(1);
  });

  it("normalizes a new-shape config and back-fills image fields", () => {
    const next = {
      background: "#fff",
      surfaces: {
        topbar: [{ id: "a", content: { type: "image", src: "x.png" }, rect: { x: 0, y: 0, w: 0.5, h: 0.5 } }],
        clock: [],
        "leg-left": [],
        "leg-right": [],
      },
    };
    const cfg = migrate(next);
    const img = cfg.surfaces.topbar[0].content;
    expect(img.type).toBe("image");
    if (img.type === "image") {
      expect(img.scale).toBe(1);
      expect(img.offset).toEqual({ x: 0, y: 0 });
      expect(img.padding).toBe(0);
      expect(img.background).toBeNull();
    }
  });

  it("maps a retired content type to text rather than crashing", () => {
    const comp = normalizeComponent({ content: { type: "brand" }, rect: {} });
    expect(comp.content.type).toBe("text");
  });
});

describe("clampRect", () => {
  it("keeps a rect inside the surface with a minimum size", () => {
    expect(clampRect({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 })).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(clampRect({ x: -1, y: -1, w: 2, h: 2 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("never collapses below the minimum", () => {
    const r = clampRect({ x: 0.5, y: 0.5, w: 0, h: 0 });
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
  });
});
