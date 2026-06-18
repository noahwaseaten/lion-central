import { describe, expect, it } from "vitest";

import type { NormRect } from "./layout-model";
import { snapMove, snapResize } from "./snapping";

const rect = (x: number, y: number, w: number, h: number): NormRect => ({ x, y, w, h });

describe("snapMove", () => {
  it("snaps a near-edge to the surface boundary and reports a guide", () => {
    const r = snapMove(rect(0.02, 0.3, 0.4, 0.4), [], 0.05);
    expect(r.rect.x).toBe(0); // left edge snapped to 0
    expect(r.guides).toContainEqual({ axis: "x", pos: 0 });
  });

  it("snaps the center to the surface midline", () => {
    // center at 0.48 → snaps so center sits at 0.5
    const r = snapMove(rect(0.28, 0, 0.4, 1), [], 0.05);
    expect(r.rect.x + r.rect.w / 2).toBeCloseTo(0.5, 6);
  });

  it("leaves a rect untouched when nothing is within threshold", () => {
    // edges/centers (0.2 / 0.325 / 0.45) sit clear of the 0 / 0.5 / 1 lines
    const r = snapMove(rect(0.2, 0.2, 0.25, 0.25), [], 0.01);
    expect(r.rect).toEqual(rect(0.2, 0.2, 0.25, 0.25));
    expect(r.guides).toHaveLength(0);
  });

  it("snaps to a sibling's edge", () => {
    const sibling = rect(0.6, 0, 0.2, 1);
    // moving rect's right edge near the sibling's left edge (0.6)
    const r = snapMove(rect(0.18, 0, 0.4, 1), [sibling], 0.05);
    expect(r.rect.x + r.rect.w).toBeCloseTo(0.6, 6);
  });

  it("uses separate x/y thresholds", () => {
    // tiny x threshold: only the left edge (already at 0.5) "snaps" (delta 0);
    // generous y threshold: the top edge (0.12) is the closest line → snaps to 0.
    const r = snapMove(rect(0.5, 0.12, 0.2, 0.2), [], 0.02, 0.2);
    expect(r.rect.x).toBe(0.5);
    expect(r.rect.y).toBe(0);
  });
});

describe("snapResize", () => {
  it("snaps only the dragged edge", () => {
    const r = snapResize(rect(0.02, 0.3, 0.5, 0.4), "w", [], 0.05);
    expect(r.rect.x).toBe(0);
    expect(r.rect.x + r.rect.w).toBeCloseTo(0.52, 6); // right edge unchanged
  });

  it("snaps the east edge to the surface boundary", () => {
    const r = snapResize(rect(0.4, 0, 0.57, 1), "e", [], 0.05);
    expect(r.rect.x + r.rect.w).toBeCloseTo(1, 6);
    expect(r.rect.x).toBe(0.4); // left edge unchanged
  });
});
