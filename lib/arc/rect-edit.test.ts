import { describe, expect, it } from "vitest";

import { applyRectEdit } from "./rect-edit";

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe("applyRectEdit", () => {
  it("applies an edit that already fits", () => {
    expect(applyRectEdit(rect(0.1, 0.1, 0.2, 0.2), { x: 0.5 })).toEqual(rect(0.5, 0.1, 0.2, 0.2));
  });

  it("shortens an oversized width instead of moving the component", () => {
    // The old clamp slid x to 0 here, which read as the panel fighting you.
    expect(applyRectEdit(rect(0.75, 0, 0.25, 1), { w: 1 })).toEqual(rect(0.75, 0, 0.25, 1));
  });

  it("shortens an oversized height instead of moving the component", () => {
    expect(applyRectEdit(rect(0, 0.6, 1, 0.4), { h: 1 })).toEqual(rect(0, 0.6, 1, 0.4));
  });

  it("pulls x back so the component stays on the surface", () => {
    expect(applyRectEdit(rect(0, 0, 0.3, 0.3), { x: 0.9 })).toEqual(rect(0.7, 0, 0.3, 0.3));
  });

  it("pulls y back so the component stays on the surface", () => {
    expect(applyRectEdit(rect(0, 0, 0.3, 0.3), { y: 0.9 })).toEqual(rect(0, 0.7, 0.3, 0.3));
  });

  it("clamps a negative position to the edge", () => {
    expect(applyRectEdit(rect(0.2, 0.2, 0.3, 0.3), { x: -0.5, y: -0.5 })).toEqual(
      rect(0, 0, 0.3, 0.3),
    );
  });

  it("holds a minimum size so a component can't be shrunk to nothing", () => {
    expect(applyRectEdit(rect(0, 0, 0.5, 0.5), { w: 0, h: 0 })).toEqual(rect(0, 0, 0.04, 0.04));
  });

  it("resizes before repositioning when both change at once", () => {
    expect(applyRectEdit(rect(0.5, 0.5, 0.2, 0.2), { x: 0, w: 1 })).toEqual(rect(0, 0.5, 0.5, 0.2));
  });

  it("leaves the rect alone for an empty patch", () => {
    expect(applyRectEdit(rect(0.25, 0.25, 0.5, 0.5), {})).toEqual(rect(0.25, 0.25, 0.5, 0.5));
  });
});
