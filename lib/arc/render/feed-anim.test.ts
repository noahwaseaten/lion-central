import { describe, expect, it } from "vitest";

import type { FeedEntry } from "@/lib/feed/types";

import { tickerRows } from "./feed-anim";

/** A minimal feed entry; `tickerRows` only keys off `id`. */
const e = (id: string): FeedEntry => ({
  id,
  bib: id,
  first: "A",
  last: "B",
  name: "A B",
  timeRaw: "0:10",
  seconds: 600,
  split: "swim",
});

/** Fresh canvas key per test so per-instance state never leaks across tests. */
const freshCanvas = () => ({}) as unknown as HTMLCanvasElement;

describe("tickerRows", () => {
  it("returns nothing before any athlete is seen", () => {
    expect(tickerRows(freshCanvas(), "k", [], 3, 300, 0)).toEqual([]);
  });

  it("shows the latest finishers static, newest at the bottom", () => {
    const c = freshCanvas();
    const entries = [e("3"), e("2"), e("1")]; // snapshot is newest-first
    tickerRows(c, "k", entries, 3, 300, 0); // first sight starts a glide
    const settled = tickerRows(c, "k", entries, 3, 300, 1000); // past the transition

    const byId = Object.fromEntries(settled.map((r) => [r.entry.id, r]));
    expect(byId["3"].y).toBeCloseTo(200); // newest at the bottom slot (rowH 100)
    expect(byId["3"].alpha).toBe(1);
    expect(byId["1"].y).toBeCloseTo(0); // oldest at the top
  });

  it("stays perfectly static between appends (no perpetual loop)", () => {
    const c = freshCanvas();
    const entries = [e("3"), e("2"), e("1")];
    tickerRows(c, "k", entries, 3, 300, 0); // first sight starts (and finishes) a glide
    const a = tickerRows(c, "k", entries, 3, 300, 1000); // settled
    const b = tickerRows(c, "k", entries, 3, 300, 9999); // much later, same data
    expect(b.map((r) => ({ id: r.entry.id, y: r.y, alpha: r.alpha }))).toEqual(
      a.map((r) => ({ id: r.entry.id, y: r.y, alpha: r.alpha })),
    );
  });

  it("glides one row in when a new line is appended", () => {
    const c = freshCanvas();
    tickerRows(c, "k", [e("1")], 3, 300, 0);
    tickerRows(c, "k", [e("1")], 3, 300, 1000); // settled

    // append "2" → newest id changes, a glide begins at t=1000
    const start = tickerRows(c, "k", [e("2"), e("1")], 3, 300, 1000);
    const newAtStart = start.find((r) => r.entry.id === "2")!;
    expect(newAtStart.alpha).toBe(0); // newest fades in from nothing

    const end = tickerRows(c, "k", [e("2"), e("1")], 3, 300, 1760); // glide complete
    const newAtEnd = end.find((r) => r.entry.id === "2")!;
    expect(newAtEnd.alpha).toBe(1);
    expect(newAtEnd.y).toBeCloseTo(200); // settled at the bottom
  });

  it("fades the overflowing top row out during the glide, then drops it", () => {
    const c = freshCanvas();
    tickerRows(c, "k", [e("2"), e("1")], 2, 200, 0);
    tickerRows(c, "k", [e("2"), e("1")], 2, 200, 1000); // settled, 2 rows fill 2 slots

    // append "3" → "1" overflows the top
    const mid = tickerRows(c, "k", [e("3"), e("2"), e("1")], 2, 200, 1000);
    expect(mid.find((r) => r.entry.id === "1")).toBeDefined(); // still fading out

    const done = tickerRows(c, "k", [e("3"), e("2"), e("1")], 2, 200, 1760);
    expect(done.find((r) => r.entry.id === "1")).toBeUndefined(); // gone
    expect(done.map((r) => r.entry.id).sort()).toEqual(["2", "3"]);
  });

  it("batches simultaneous arrivals into one glide (both new rows fade in together)", () => {
    const c = freshCanvas();
    tickerRows(c, "k", [e("1")], 3, 300, 0);
    tickerRows(c, "k", [e("1")], 3, 300, 1000); // settled

    // two athletes arrive at once
    const start = tickerRows(c, "k", [e("3"), e("2"), e("1")], 3, 300, 1000);
    expect(start.find((r) => r.entry.id === "2")!.alpha).toBe(0);
    expect(start.find((r) => r.entry.id === "3")!.alpha).toBe(0);

    const end = tickerRows(c, "k", [e("3"), e("2"), e("1")], 3, 300, 1760);
    const byId = Object.fromEntries(end.map((r) => [r.entry.id, r]));
    expect(byId["2"].alpha).toBe(1);
    expect(byId["3"].alpha).toBe(1);
    expect(byId["3"].y).toBeCloseTo(200); // newest at the bottom
    expect(byId["2"].y).toBeCloseTo(100);
  });

  it("snaps instantly when a burst is larger than the visible window", () => {
    const c = freshCanvas();
    tickerRows(c, "k", [e("1")], 2, 200, 0);
    tickerRows(c, "k", [e("1")], 2, 200, 1000); // settled, rows=2

    // 4 new arrive at once (> 2 rows) → snap, no mid-glide fade
    const snap = tickerRows(c, "k", [e("5"), e("4"), e("3"), e("2"), e("1")], 2, 200, 1000);
    const ids = snap.map((r) => r.entry.id).sort();
    expect(ids).toEqual(["4", "5"]); // jumped straight to the latest two
    expect(snap.every((r) => r.alpha === 1)).toBe(true); // no glide
  });
});
