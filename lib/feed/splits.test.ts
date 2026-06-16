import { describe, expect, it } from "vitest";

import { inferSplit } from "./splits";
import type { SplitThresholds } from "./types";

const T: SplitThresholds = { swimEndSec: 1000, bikeEndSec: 5000, graceSec: 100 };

describe("inferSplit", () => {
  it("classifies clearly within each window", () => {
    expect(inferSplit(0, T)).toBe("swim");
    expect(inferSplit(500, T)).toBe("swim");
    expect(inferSplit(2000, T)).toBe("bike");
    expect(inferSplit(8000, T)).toBe("run");
  });

  it("applies the grace buffer past the swim boundary", () => {
    // swimEnd 1000, grace 100 → still swim up to 1099, bike from 1100
    expect(inferSplit(1050, T)).toBe("swim");
    expect(inferSplit(1100, T)).toBe("bike");
  });

  it("applies the grace buffer past the bike boundary", () => {
    expect(inferSplit(5050, T)).toBe("bike");
    expect(inferSplit(5100, T)).toBe("run");
  });

  it("uses default thresholds when none provided", () => {
    expect(inferSplit(0)).toBe("swim");
  });
});
