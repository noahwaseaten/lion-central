// lib/arc/content.test.ts
import { describe, expect, it } from "vitest";

import { normalizeContent } from "./content";

describe("normalizeContent — sponsors items", () => {
  it("migrates legacy images: string[] to items with default transforms", () => {
    const out = normalizeContent({
      type: "sponsors",
      images: ["a.png", "b.png"],
      mode: "grid",
      intervalMs: 5000,
      columns: "auto",
      cellPadding: 0.12,
    });
    expect(out.type).toBe("sponsors");
    if (out.type !== "sponsors") return;
    expect(out.items).toEqual([
      { src: "a.png", fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null },
      { src: "b.png", fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null },
    ]);
  });

  it("keeps and back-fills already-migrated items", () => {
    const out = normalizeContent({
      type: "sponsors",
      items: [{ src: "x.png", scale: 2 }],
      mode: "rotate",
      intervalMs: 3000,
      columns: 3,
      cellPadding: 0.2,
    });
    if (out.type !== "sponsors") return;
    expect(out.items[0]).toEqual({
      src: "x.png", fit: "contain", scale: 2, offset: { x: 0, y: 0 }, padding: 0, background: null,
    });
    expect(out.mode).toBe("rotate");
    expect(out.columns).toBe(3);
  });

  it("drops non-string / src-less sponsor items", () => {
    const out = normalizeContent({ type: "sponsors", items: [{ scale: 2 }, "nope", { src: "ok.png" }] });
    if (out.type !== "sponsors") return;
    expect(out.items.map((i) => i.src)).toEqual(["ok.png"]);
  });
});

describe("normalizeContent — qr", () => {
  it("returns default label when label is missing", () => {
    const out = normalizeContent({ type: "qr", url: "https://results.example.com" });
    expect(out).toEqual({ type: "qr", url: "https://results.example.com", label: "Scan for results" });
  });

  it("keeps a provided label", () => {
    const out = normalizeContent({ type: "qr", url: "https://x.com", label: "Track your athlete" });
    expect(out).toEqual({ type: "qr", url: "https://x.com", label: "Track your athlete" });
  });

  it("coerces missing url to empty string", () => {
    const out = normalizeContent({ type: "qr" });
    expect(out).toEqual({ type: "qr", url: "", label: "Scan for results" });
  });
});
