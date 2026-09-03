import { describe, expect, it } from "vitest";

import { thumbSize } from "./thumbnails";

describe("thumbSize", () => {
  it("scales a large raster down to the thumbnail box", () => {
    expect(thumbSize(1000, 500, false)).toEqual({ w: 192, h: 96 });
  });

  it("leaves a raster smaller than the box alone", () => {
    expect(thumbSize(64, 32, false)).toEqual({ w: 64, h: 32 });
  });

  it("rasterises a small vector up to fill the box", () => {
    // A 24px-viewBox logo still has to look sharp in an 80px tile.
    expect(thumbSize(24, 24, true)).toEqual({ w: 192, h: 192 });
  });

  it("scales a large vector down like any other source", () => {
    expect(thumbSize(2000, 1000, true)).toEqual({ w: 192, h: 96 });
  });

  it("never rounds an edge away to zero", () => {
    expect(thumbSize(1000, 3, false)).toEqual({ w: 192, h: 1 });
  });

  it("returns nothing for a degenerate size", () => {
    expect(thumbSize(0, 0, false)).toEqual({ w: 0, h: 0 });
    expect(thumbSize(Number.NaN, 10, true)).toEqual({ w: 0, h: 0 });
  });
});
