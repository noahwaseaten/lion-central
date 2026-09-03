import { describe, expect, it } from "vitest";

import { defaultTransform, type SponsorItem } from "./content";
import {
  applyFramingToAll,
  framingOf,
  isDefaultFraming,
  moveItem,
  removeAt,
} from "./sponsor-items";

const item = (src: string, over: Partial<SponsorItem> = {}): SponsorItem => ({
  src,
  ...defaultTransform(),
  ...over,
});

describe("moveItem", () => {
  it("moves an item later", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("moves an item earlier", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("clamps past the ends instead of dropping the item", () => {
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 9)).toEqual(["a", "b", "c"]);
  });

  it("returns the same array when nothing moves", () => {
    const items = ["a", "b"];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, 5, 0)).toBe(items);
  });
});

describe("removeAt", () => {
  it("removes the item at the index", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("ignores an out-of-range index", () => {
    const items = ["a"];
    expect(removeAt(items, 3)).toBe(items);
    expect(removeAt(items, -1)).toBe(items);
  });
});

describe("applyFramingToAll", () => {
  it("copies framing onto every logo but keeps each source", () => {
    const items = [item("/a.svg"), item("/b.svg"), item("/c.svg")];
    const framing = { ...defaultTransform(), padding: 0.2, fit: "cover" as const, scale: 1.5 };

    const next = applyFramingToAll(items, framing);

    expect(next.map((i) => i.src)).toEqual(["/a.svg", "/b.svg", "/c.svg"]);
    for (const i of next) {
      expect(i.padding).toBe(0.2);
      expect(i.fit).toBe("cover");
      expect(i.scale).toBe(1.5);
    }
  });

  it("handles an empty list", () => {
    expect(applyFramingToAll([], defaultTransform())).toEqual([]);
  });
});

describe("isDefaultFraming", () => {
  it("is true for an untouched logo", () => {
    expect(isDefaultFraming(item("/a.svg"))).toBe(true);
  });

  it("notices each kind of edit", () => {
    expect(isDefaultFraming(item("/a.svg", { padding: 0.1 }))).toBe(false);
    expect(isDefaultFraming(item("/a.svg", { fit: "cover" }))).toBe(false);
    expect(isDefaultFraming(item("/a.svg", { scale: 1.2 }))).toBe(false);
    expect(isDefaultFraming(item("/a.svg", { offset: { x: 0.1, y: 0 } }))).toBe(false);
    expect(isDefaultFraming(item("/a.svg", { background: "#fff" }))).toBe(false);
    expect(
      isDefaultFraming(item("/a.svg", { shadow: { enabled: true, color: "#000", blur: 8, opacity: 0.5 } })),
    ).toBe(false);
  });
});

describe("framingOf", () => {
  it("drops the source and keeps the transform", () => {
    const framing = framingOf(item("/a.svg", { padding: 0.25 }));
    expect(framing).not.toHaveProperty("src");
    expect(framing.padding).toBe(0.25);
  });
});
