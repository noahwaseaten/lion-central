import { describe, expect, it } from "vitest";

import { assetDisplayName } from "./assets-shared";

describe("assetDisplayName", () => {
  it("strips the uniqueness token from a stored id", () => {
    expect(assetDisplayName("ygxhqnr02rwz__sportdepot.svg")).toBe("sportdepot.svg");
  });

  it("strips the path from an asset url", () => {
    expect(assetDisplayName("/api/assets/uiqxa4jv2rst__alphawin.svg")).toBe("alphawin.svg");
  });

  it("ignores a query string or hash", () => {
    expect(assetDisplayName("/api/assets/ab12__logo.svg?v=2")).toBe("logo.svg");
    expect(assetDisplayName("/api/assets/ab12__logo.svg#a")).toBe("logo.svg");
  });

  it("leaves a name with no token alone", () => {
    expect(assetDisplayName("https://cdn.example.com/logo.png")).toBe("logo.png");
  });

  it("keeps a double underscore inside the uploaded name", () => {
    expect(assetDisplayName("tok1__my__logo.svg")).toBe("my__logo.svg");
  });

  it("falls back to the input when there is no filename", () => {
    expect(assetDisplayName("")).toBe("");
  });
});
