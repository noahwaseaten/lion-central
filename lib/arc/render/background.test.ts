import { describe, expect, it } from "vitest";

import { syncTarget, videoSourceRect } from "./background";

describe("videoSourceRect", () => {
  // A 2x1 arc box (e.g. a wide top bar + legs below) with a video whose aspect
  // matches exactly, so "cover" fit maps 1:1 with no letterboxing.
  const box = { w: 200, h: 100 };

  it("maps a surface's placement straight through when video and box aspect match", () => {
    // Video is 2x1 same as the box (scaled 2x: 100x50 video → 200x100 box).
    const rect = videoSourceRect({ id: "topbar", x: 0, y: 0, w: 200, h: 50 }, box, 100, 50);
    expect(rect).toEqual({ sx: 0, sy: 0, sw: 100, sh: 25 });
  });

  it("crops a slice from the middle of the video for an offset placement", () => {
    const rect = videoSourceRect({ id: "leg-left", x: 50, y: 50, w: 50, h: 50 }, box, 100, 50);
    expect(rect).toEqual({ sx: 25, sy: 25, sw: 25, sh: 25 });
  });

  it("clamps to the video bounds instead of returning an out-of-range rect", () => {
    // Box taller than the video's aspect → letterboxed, offY > 0; a placement
    // right at the box edge must not read past the video's actual height.
    const tallBox = { w: 100, h: 400 };
    const rect = videoSourceRect({ id: "leg-left", x: 0, y: 380, w: 100, h: 20 }, tallBox, 100, 50);
    expect(rect).not.toBeNull();
    expect(rect!.sy + rect!.sh).toBeLessThanOrEqual(50);
  });

  it("returns null for a degenerate (zero-size) video or box", () => {
    expect(videoSourceRect({ id: "clock", x: 0, y: 0, w: 10, h: 10 }, box, 0, 0)).toBeNull();
    expect(videoSourceRect({ id: "clock", x: 0, y: 0, w: 10, h: 10 }, { w: 0, h: 0 }, 100, 50)).toBeNull();
  });
});

describe("syncTarget", () => {
  it("wraps wall-clock time into the clip's duration", () => {
    expect(syncTarget(5000, 10)).toBeCloseTo(5, 5);
    expect(syncTarget(25_000, 10)).toBeCloseTo(5, 5); // 2.5 loops in → same position
  });
});
