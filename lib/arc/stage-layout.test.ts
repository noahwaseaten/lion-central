import { describe, expect, it } from "vitest";

import { CLOCK, LEG, TOP_BAR } from "./layout";
import { defaultSurfaceSizes } from "./surfaces";
import {
  arrangePlacements,
  boundingBox,
  centerOffset,
  componentPixelSize,
  componentRectNative,
  fitScale,
  getPlacement,
  STAGE_BOX,
  SURFACE_PLACEMENTS,
} from "./stage-layout";

describe("STAGE_BOX", () => {
  it("spans the top bar's width and clock+bar+leg height", () => {
    expect(STAGE_BOX.w).toBe(TOP_BAR.w);
    expect(STAGE_BOX.h).toBe(CLOCK.h + TOP_BAR.h + LEG.h);
  });
});

describe("SURFACE_PLACEMENTS", () => {
  it("centers the clock above the bar", () => {
    const clock = getPlacement("clock")!;
    expect(clock.y).toBe(0);
    expect(clock.x).toBe((TOP_BAR.w - CLOCK.w) / 2);
    // symmetric within the box
    expect(clock.x + clock.w + clock.x).toBe(TOP_BAR.w);
  });

  it("hangs the legs from the bar's bottom corners", () => {
    const left = getPlacement("leg-left")!;
    const right = getPlacement("leg-right")!;
    expect(left.x).toBe(0);
    expect(right.x).toBe(TOP_BAR.w - LEG.w);
    expect(left.y).toBe(CLOCK.h + TOP_BAR.h);
    expect(right.y).toBe(left.y);
  });

  it("keeps every placement inside the bounding box", () => {
    for (const p of SURFACE_PLACEMENTS) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(STAGE_BOX.w);
      expect(p.y + p.h).toBeLessThanOrEqual(STAGE_BOX.h);
    }
  });
});

describe("componentRectNative", () => {
  it("offsets a normalized rect by its surface placement", () => {
    // a full-surface component on the top bar is offset down by the clock height
    const full = componentRectNative("topbar", { x: 0, y: 0, w: 1, h: 1 })!;
    expect(full.x).toBe(0);
    expect(full.y).toBe(CLOCK.h);
    expect(full.w).toBe(TOP_BAR.w);
    expect(full.h).toBe(TOP_BAR.h);
  });

  it("scales a partial rect within its surface", () => {
    const half = componentRectNative("topbar", { x: 0.5, y: 0, w: 0.5, h: 1 })!;
    expect(half.x).toBe(TOP_BAR.w / 2);
    expect(half.w).toBe(TOP_BAR.w / 2);
  });
});

describe("componentPixelSize", () => {
  it("returns the component's native pixel size", () => {
    const size = componentPixelSize("leg-left", { x: 0, y: 0, w: 1, h: 0.5 });
    expect(size.w).toBe(LEG.w);
    expect(size.h).toBe(LEG.h / 2);
  });
});

describe("arrangePlacements / boundingBox", () => {
  it("matches SURFACE_PLACEMENTS at the default (native) sizes", () => {
    expect(arrangePlacements(defaultSurfaceSizes())).toEqual(SURFACE_PLACEMENTS);
  });

  it("arranges each surface at its own edited resolution", () => {
    const placements = arrangePlacements({
      clock: { w: CLOCK.w * 2, h: CLOCK.h * 2 },
      topbar: { w: TOP_BAR.w, h: TOP_BAR.h },
      "leg-left": { w: LEG.w * 0.5, h: LEG.h * 0.5 },
      "leg-right": { w: LEG.w * 1.5, h: LEG.h * 1.5 },
    });
    const clock = placements.find((p) => p.id === "clock")!;
    const legLeft = placements.find((p) => p.id === "leg-left")!;
    const legRight = placements.find((p) => p.id === "leg-right")!;
    expect(clock.w).toBeCloseTo(CLOCK.w * 2, 5);
    expect(clock.h).toBeCloseTo(CLOCK.h * 2, 5);
    expect(legLeft.w).toBeCloseTo(LEG.w * 0.5, 5);
    expect(legLeft.h).toBeCloseTo(LEG.h * 0.5, 5);
    expect(legRight.w).toBeCloseTo(LEG.w * 1.5, 5);
  });

  it("still centers the clock and hangs the legs off the (resized) bar", () => {
    const placements = arrangePlacements({
      clock: { w: CLOCK.w * 1.5, h: CLOCK.h * 1.5 },
      topbar: { w: TOP_BAR.w * 2, h: TOP_BAR.h * 2 },
      "leg-left": { w: LEG.w, h: LEG.h },
      "leg-right": { w: LEG.w, h: LEG.h },
    });
    const clock = placements.find((p) => p.id === "clock")!;
    const topbar = placements.find((p) => p.id === "topbar")!;
    const legLeft = placements.find((p) => p.id === "leg-left")!;
    const legRight = placements.find((p) => p.id === "leg-right")!;
    expect(clock.x).toBeCloseTo((topbar.w - clock.w) / 2, 5);
    expect(legLeft.x).toBe(0);
    expect(legLeft.y).toBe(clock.h + topbar.h);
    expect(legRight.x).toBeCloseTo(topbar.w - legRight.w, 5);
  });

  it("bounding box spans the widest/tallest extent of the placements", () => {
    const placements = arrangePlacements(defaultSurfaceSizes());
    expect(boundingBox(placements)).toEqual({ w: STAGE_BOX.w, h: STAGE_BOX.h });
  });
});

describe("fitScale / centerOffset", () => {
  it("fits the box into the container with padding", () => {
    // container exactly the box size → scale is the padding factor
    expect(fitScale(STAGE_BOX.w, STAGE_BOX.h, 0.9)).toBeCloseTo(0.9, 5);
  });

  it("is limited by the tighter dimension", () => {
    const wide = fitScale(STAGE_BOX.w * 4, STAGE_BOX.h, 1);
    expect(wide).toBeCloseTo(1, 5); // height-bound
  });

  it("returns 0 for a degenerate container", () => {
    expect(fitScale(0, 100)).toBe(0);
    expect(fitScale(100, 0)).toBe(0);
  });

  it("centers the scaled box", () => {
    const { x, y } = centerOffset(STAGE_BOX.w, STAGE_BOX.h, 0.5);
    expect(x).toBeCloseTo((STAGE_BOX.w - STAGE_BOX.w * 0.5) / 2, 5);
    expect(y).toBeCloseTo((STAGE_BOX.h - STAGE_BOX.h * 0.5) / 2, 5);
  });
});
