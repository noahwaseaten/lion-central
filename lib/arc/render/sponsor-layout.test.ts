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
