import { describe, expect, it } from "vitest";

import { defaultSurfaceSizes } from "./surfaces";
import { clampRect, clampSurfaceSize, defaultConfig, migrate, normalizeComponent } from "./layout-model";

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
    expect(cfg.background).toEqual({ mode: "solid", color: "#101010", videoSrc: "" });
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

describe("migrate — surfaceSizes", () => {
  it("defaults to native resolution for empty / junk input", () => {
    expect(migrate(null).surfaceSizes).toEqual(defaultSurfaceSizes());
    expect(migrate({}).surfaceSizes).toEqual(defaultSurfaceSizes());
  });

  it("carries forward a valid persisted resolution", () => {
    const cfg = migrate({ surfaces: {}, surfaceSizes: { topbar: { w: 1920, h: 300 } } });
    expect(cfg.surfaceSizes.topbar).toEqual({ w: 1920, h: 300 });
    // untouched surfaces keep the default
    expect(cfg.surfaceSizes.clock).toEqual(defaultSurfaceSizes().clock);
  });

  it("falls back to the default for a garbage entry instead of crashing", () => {
    const cfg = migrate({ surfaces: {}, surfaceSizes: { "leg-left": { w: "big", h: null } } });
    expect(cfg.surfaceSizes["leg-left"]).toEqual(defaultSurfaceSizes()["leg-left"]);
  });
});

describe("migrate — background", () => {
  it("converts a legacy bare hex string to a solid BackgroundConfig", () => {
    expect(migrate({ background: "#123456" }).background).toEqual(
      expect.objectContaining({ mode: "solid", color: "#123456" }),
    );
  });

  it("passes through a valid video config", () => {
    const cfg = migrate({ background: { mode: "video", color: "#fff", videoSrc: "/assets/bg.mp4" } });
    expect(cfg.background).toEqual({ mode: "video", color: "#fff", videoSrc: "/assets/bg.mp4" });
  });

  it("falls back to the default for junk instead of crashing", () => {
    expect(migrate({ background: 42 }).background).toEqual(defaultConfig().background);
    expect(migrate({}).background).toEqual(defaultConfig().background);
  });
});

describe("clampSurfaceSize", () => {
  it("keeps a reasonable size unchanged (rounded)", () => {
    expect(clampSurfaceSize(1280.4, 256.6)).toEqual({ w: 1280, h: 257 });
  });

  it("clamps out-of-range values instead of allowing a zero/absurd surface", () => {
    expect(clampSurfaceSize(0, -50)).toEqual({ w: 16, h: 16 });
    expect(clampSurfaceSize(999999, 999999)).toEqual({ w: 8000, h: 8000 });
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
