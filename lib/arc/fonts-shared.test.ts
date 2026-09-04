import { describe, expect, it } from "vitest";

import { fontContentTypeFor, isFontFilename, isValidFontId, sanitizeFontFamily } from "./fonts-shared";

describe("isFontFilename", () => {
  it("accepts supported font extensions", () => {
    expect(isFontFilename("RistrettoSlabPro-Regular.otf")).toBe(true);
    expect(isFontFilename("font.ttf")).toBe(true);
    expect(isFontFilename("font.woff")).toBe(true);
    expect(isFontFilename("font.woff2")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isFontFilename("font.png")).toBe(false);
    expect(isFontFilename("font")).toBe(false);
  });
});

describe("fontContentTypeFor", () => {
  it("maps known extensions", () => {
    expect(fontContentTypeFor("tok__x.otf")).toBe("font/otf");
    expect(fontContentTypeFor("tok__x.ttf")).toBe("font/ttf");
    expect(fontContentTypeFor("tok__x.woff")).toBe("font/woff");
    expect(fontContentTypeFor("tok__x.woff2")).toBe("font/woff2");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(fontContentTypeFor("tok__x.exe")).toBe("application/octet-stream");
  });
});

describe("isValidFontId", () => {
  it("accepts a plain token+extension id", () => {
    expect(isValidFontId("0w87fs3912xo.otf")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(isValidFontId("../../etc/passwd")).toBe(false);
    expect(isValidFontId("a..b.otf")).toBe(false);
  });

  it("rejects an id starting with a non-alphanumeric", () => {
    expect(isValidFontId(".hidden.otf")).toBe(false);
  });
});

describe("sanitizeFontFamily", () => {
  it("strips quotes and backslashes", () => {
    expect(sanitizeFontFamily(`evil"; } * { color: red`)).toBe("evil; } * { color: red");
    expect(sanitizeFontFamily("back\\slash")).toBe("backslash");
  });

  it("trims whitespace", () => {
    expect(sanitizeFontFamily("  Bebas Neue  ")).toBe("Bebas Neue");
  });

  it("caps length", () => {
    expect(sanitizeFontFamily("a".repeat(200)).length).toBe(100);
  });
});
