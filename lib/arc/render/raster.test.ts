import { describe, expect, it } from "vitest";

import { isVectorSrc, overBudget, rasterBucket } from "./raster";

describe("rasterBucket", () => {
  it("rounds the long edge up to a power of two", () => {
    expect(rasterBucket(300, 300)).toEqual({ w: 512, h: 512 });
    expect(rasterBucket(513, 513)).toEqual({ w: 1024, h: 1024 });
  });

  it("keeps the aspect ratio", () => {
    const { w, h } = rasterBucket(600, 150);
    expect(w).toBe(1024);
    expect(h).toBe(256);
  });

  it("settles on one bucket across sub-pixel wobble", () => {
    // Draw sizes drift as the stage zooms; the cache is only worth having if
    // near-identical sizes land on the same raster.
    const sizes = [299.4, 300, 301.7, 320, 400, 511.2];
    const buckets = new Set(sizes.map((s) => rasterBucket(s, s).w));
    expect(buckets).toEqual(new Set([512]));
  });

  it("clamps to the maximum edge", () => {
    expect(rasterBucket(9000, 9000)).toEqual({ w: 2048, h: 2048 });
  });

  it("never goes below the minimum edge", () => {
    expect(rasterBucket(10, 10)).toEqual({ w: 64, h: 64 });
  });

  it("returns nothing for a degenerate size", () => {
    expect(rasterBucket(0, 0)).toEqual({ w: 0, h: 0 });
    expect(rasterBucket(Number.NaN, 10)).toEqual({ w: 0, h: 0 });
  });
});

describe("overBudget", () => {
  const entry = (w: number, h: number, used: number) => ({ w, h, used });

  it("drops nothing while under budget", () => {
    expect(overBudget([["a", entry(100, 100, 1)]], 1_000_000)).toEqual([]);
  });

  it("drops the least recently drawn entries first", () => {
    const entries: [string, { w: number; h: number; used: number }][] = [
      ["new", entry(100, 100, 30)],
      ["old", entry(100, 100, 10)],
      ["mid", entry(100, 100, 20)],
    ];
    expect(overBudget(entries, 15_000)).toEqual(["old", "mid"]);
  });

  it("stops as soon as it is back under budget", () => {
    const entries: [string, { w: number; h: number; used: number }][] = [
      ["old", entry(100, 100, 1)],
      ["new", entry(100, 100, 2)],
    ];
    expect(overBudget(entries, 15_000)).toEqual(["old"]);
  });
});

describe("isVectorSrc", () => {
  it("matches svg urls, including query and hash suffixes", () => {
    expect(isVectorSrc("/api/assets/abc__logo.svg")).toBe(true);
    expect(isVectorSrc("/api/assets/abc__logo.SVG?v=2")).toBe(true);
    expect(isVectorSrc("/api/assets/abc__logo.svg#frag")).toBe(true);
    expect(isVectorSrc("data:image/svg+xml;base64,AAAA")).toBe(true);
  });

  it("leaves raster sources alone", () => {
    expect(isVectorSrc("/api/assets/abc__logo.png")).toBe(false);
    expect(isVectorSrc("/svg-icons/thing.png")).toBe(false);
    expect(isVectorSrc("data:image/png;base64,AAAA")).toBe(false);
  });
});
