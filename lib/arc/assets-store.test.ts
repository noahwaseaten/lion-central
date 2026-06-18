import { describe, it, expect } from "vitest";
import { isVideoAsset, contentTypeFor } from "./assets-store";

describe("isVideoAsset", () => {
  it("returns true for .mp4", () => {
    expect(isVideoAsset("abc123__video.mp4")).toBe(true);
  });
  it("returns true for .webm", () => {
    expect(isVideoAsset("abc123__clip.webm")).toBe(true);
  });
  it("returns true for .mov", () => {
    expect(isVideoAsset("abc123__recording.mov")).toBe(true);
  });
  it("returns false for .png", () => {
    expect(isVideoAsset("abc123__logo.png")).toBe(false);
  });
  it("returns false for .svg", () => {
    expect(isVideoAsset("abc123__icon.svg")).toBe(false);
  });
});

describe("contentTypeFor — video extensions", () => {
  it("maps .mp4 to video/mp4", () => {
    expect(contentTypeFor("abc123__video.mp4")).toBe("video/mp4");
  });
  it("maps .webm to video/webm", () => {
    expect(contentTypeFor("abc123__clip.webm")).toBe("video/webm");
  });
  it("maps .mov to video/quicktime", () => {
    expect(contentTypeFor("abc123__rec.mov")).toBe("video/quicktime");
  });
});
