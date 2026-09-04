import { describe, expect, it } from "vitest";

import { applyOffsets, NO_OFFSETS } from "./offsets";

const base = {
  id: "500-04:30:00",
  bib: "500",
  first: "ELENA",
  last: "FISCHER",
  name: "Elena Fischer",
  timeRaw: "04:30:00",
  seconds: 4 * 3600 + 30 * 60,
};

describe("applyOffsets", () => {
  it("subtracts the offset from half-marathon times", () => {
    const e = applyOffsets(base, { halfOffsetSec: 3 * 3600 });
    expect(e.category).toBe("half");
    expect(e.displaySeconds).toBe(90 * 60);
    expect(e.displayTime).toBe("01:30:00");
  });

  it("keeps the raw token when nothing is subtracted", () => {
    const e = applyOffsets(base, NO_OFFSETS);
    expect(e.displaySeconds).toBe(base.seconds);
    expect(e.displayTime).toBe("04:30:00");
  });

  it("leaves other categories untouched", () => {
    const relay = applyOffsets({ ...base, bib: "900" }, { halfOffsetSec: 3 * 3600 });
    expect(relay.category).toBe("relay");
    expect(relay.displayTime).toBe("04:30:00");

    const ultra = applyOffsets({ ...base, bib: "12" }, { halfOffsetSec: 3 * 3600 });
    expect(ultra.category).toBe("ultra");
    expect(ultra.displayTime).toBe("04:30:00");
  });

  it("clamps at zero when the offset exceeds the reported time", () => {
    const e = applyOffsets(base, { halfOffsetSec: 10 * 3600 });
    expect(e.displaySeconds).toBe(0);
    expect(e.displayTime).toBe("00:00:00");
  });

  it("keeps MM:SS source tokens in MM:SS", () => {
    const e = applyOffsets(
      { ...base, id: "500-40:00", timeRaw: "40:00", seconds: 2400 },
      { halfOffsetSec: 600 },
    );
    expect(e.displayTime).toBe("30:00");
  });
});
