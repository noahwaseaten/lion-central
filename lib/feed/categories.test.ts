import { describe, expect, it } from "vitest";

import { inferCategory } from "./categories";

describe("inferCategory", () => {
  it("classifies each bib window", () => {
    expect(inferCategory("0")).toBe("ultra");
    expect(inferCategory("264")).toBe("ultra");
    expect(inferCategory("400")).toBe("half");
    expect(inferCategory("700")).toBe("half");
    expect(inferCategory("800")).toBe("relay");
    expect(inferCategory("1042")).toBe("relay");
  });

  it("falls back to other for bibs between the windows", () => {
    expect(inferCategory("265")).toBe("other");
    expect(inferCategory("399")).toBe("other");
    expect(inferCategory("701")).toBe("other");
    expect(inferCategory("799")).toBe("other");
  });

  it("falls back to other for non-numeric bibs", () => {
    expect(inferCategory("R12")).toBe("other");
    expect(inferCategory("")).toBe("other");
  });
});
