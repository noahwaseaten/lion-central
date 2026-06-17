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
