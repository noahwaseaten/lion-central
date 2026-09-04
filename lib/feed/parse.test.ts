import { describe, expect, it } from "vitest";

import { parseLine, parseLines, parseTime } from "./parse";

describe("parseTime", () => {
  it("parses HH:MM:SS", () => {
    expect(parseTime("01:18:50")).toBe(4730);
  });
  it("parses H:MM:SS", () => {
    expect(parseTime("2:05:14")).toBe(7514);
  });
  it("parses MM:SS", () => {
    expect(parseTime("24:31")).toBe(1471);
  });
  it("rejects out-of-range minutes/seconds", () => {
    expect(parseTime("01:60:00")).toBeNull();
    expect(parseTime("01:00:60")).toBeNull();
  });
  it("rejects non-numeric and malformed", () => {
    expect(parseTime("aa:bb")).toBeNull();
    expect(parseTime("1:2:3:4")).toBeNull();
    expect(parseTime("12")).toBeNull();
  });
});

describe("parseLine", () => {
  it("parses BIB FIRST LAST TIME", () => {
    const e = parseLine("1042 MARCUS BENNETT 00:24:31");
    expect(e).toMatchObject({
      bib: "1042",
      first: "MARCUS",
      last: "BENNETT",
      name: "Marcus Bennett",
      timeRaw: "00:24:31",
      seconds: 1471,
      category: "relay",
      displayTime: "00:24:31",
    });
    expect(e?.id).toBe("1042-00:24:31");
  });

  it("tolerates repeated spaces", () => {
    const e = parseLine("0817   LENA    HARTMANN   01:18:50");
    expect(e?.bib).toBe("0817");
    expect(e?.name).toBe("Lena Hartmann");
  });

  it("supports multi-word last names", () => {
    const e = parseLine("0623 DIEGO DA SILVA 02:05:14");
    expect(e?.first).toBe("DIEGO");
    expect(e?.last).toBe("DA SILVA");
    expect(e?.name).toBe("Diego Da Silva");
  });

  it("returns null for too few tokens", () => {
    expect(parseLine("1042 BENNETT")).toBeNull();
    expect(parseLine("   ")).toBeNull();
  });

  it("returns null when the time is malformed", () => {
    expect(parseLine("1042 MARCUS BENNETT notatime")).toBeNull();
  });

  it("applies the half-marathon offset to the displayed time only", () => {
    const e = parseLine("512 ELENA FISCHER 04:30:00", { halfOffsetSec: 3 * 3600 });
    expect(e).toMatchObject({
      category: "half",
      timeRaw: "04:30:00",
      seconds: 16200,
      displayTime: "01:30:00",
    });
    // The id stays keyed to the raw feed token, so an offset edit never
    // re-introduces an athlete the ticker has already animated in.
    expect(e?.id).toBe("512-04:30:00");
  });
});

describe("parseLines", () => {
  const lines = [
    "1001 A AA 00:10:00",
    "garbage line",
    "1002 B BB 00:20:00",
    "1003 C CC 00:30:00",
    "1004 D DD 00:40:00",
  ];

  it("keeps the last N valid entries, newest first, skipping invalid", () => {
    const out = parseLines(lines, 3);
    expect(out.map((e) => e.bib)).toEqual(["1004", "1003", "1002"]);
  });

  it("handles fewer valid lines than requested", () => {
    expect(parseLines(["1001 A AA 00:10:00", "bad"], 3).map((e) => e.bib)).toEqual([
      "1001",
    ]);
  });
});
