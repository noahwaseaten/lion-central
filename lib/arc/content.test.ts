// lib/arc/content.test.ts
import { describe, expect, it } from "vitest";

import { defaultShadow, normalizeContent } from "./content";

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
      { src: "a.png", fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null, shadow: defaultShadow() },
      { src: "b.png", fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null, shadow: defaultShadow() },
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
      src: "x.png", fit: "contain", scale: 2, offset: { x: 0, y: 0 }, padding: 0, background: null, shadow: defaultShadow(),
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

describe("normalizeContent — text", () => {
  it("back-fills font, size, and letterSpacing on legacy content with none of those fields", () => {
    const out = normalizeContent({ type: "text", title: "Hi", subtitle: "there" });
    expect(out).toEqual({
      type: "text",
      title: "Hi",
      subtitle: "there",
      font: { source: "system" },
      size: 1,
      letterSpacing: 0,
    });
  });

  it("clamps letterSpacing to a sane range", () => {
    expect((normalizeContent({ type: "text", title: "Hi", letterSpacing: 5 }) as { letterSpacing: number }).letterSpacing).toBe(0.5);
    expect((normalizeContent({ type: "text", title: "Hi", letterSpacing: -5 }) as { letterSpacing: number }).letterSpacing).toBe(-0.1);
  });

  it("keeps a valid google font choice", () => {
    const out = normalizeContent({ type: "text", title: "Hi", font: { source: "google", family: "Bebas Neue" } });
    if (out.type !== "text") return;
    expect(out.font).toEqual({ source: "google", family: "Bebas Neue" });
  });

  it("keeps a valid custom font choice", () => {
    const out = normalizeContent({
      type: "text",
      title: "Hi",
      font: { source: "custom", family: "Ristretto Slab Pro", url: "/api/fonts/abc.otf" },
    });
    if (out.type !== "text") return;
    expect(out.font).toEqual({ source: "custom", family: "Ristretto Slab Pro", url: "/api/fonts/abc.otf" });
  });

  it("strips quotes/backslashes from a font family so it can't break out of the CSS shorthand", () => {
    const out = normalizeContent({ type: "text", title: "Hi", font: { source: "google", family: 'evil"; } * { color: red' } });
    if (out.type !== "text") return;
    expect(out.font.source).toBe("google");
    if (out.font.source !== "google") return;
    expect(out.font.family).not.toMatch(/["'\\]/);
  });

  it("falls back to system font for an incomplete or garbage font choice", () => {
    expect((normalizeContent({ type: "text", title: "Hi", font: { source: "google" } }) as { font: unknown }).font).toEqual({
      source: "system",
    });
    expect((normalizeContent({ type: "text", title: "Hi", font: "nope" }) as { font: unknown }).font).toEqual({
      source: "system",
    });
  });

  it("clamps size to a sane range", () => {
    expect((normalizeContent({ type: "text", title: "Hi", size: 50 }) as { size: number }).size).toBe(3);
    expect((normalizeContent({ type: "text", title: "Hi", size: -5 }) as { size: number }).size).toBe(0.3);
    expect((normalizeContent({ type: "text", title: "Hi", size: "big" }) as { size: number }).size).toBe(1);
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

describe("normalizeContent — weather", () => {
  it("keeps valid fields and uppercases/truncates the wind direction", () => {
    const out = normalizeContent({ type: "weather", tempC: 14, windKph: 22, windDir: "south west", condition: "rain" });
    expect(out).toEqual({ type: "weather", tempC: 14, windKph: 22, windDir: "SOUT", condition: "rain" });
  });

  it("falls back to defaults for missing/invalid fields instead of crashing", () => {
    expect(normalizeContent({ type: "weather" })).toEqual({
      type: "weather", tempC: 20, windKph: 10, windDir: "NW", condition: "sunny",
    });
    expect(normalizeContent({ type: "weather", windKph: -5, condition: "hurricane" })).toEqual({
      type: "weather", tempC: 20, windKph: 0, windDir: "NW", condition: "sunny",
    });
  });
});
