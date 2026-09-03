import { describe, expect, it } from "vitest";

import type { AssetInfo } from "@/lib/arc/assets-shared";

import { filterAssets, folderCounts } from "./library-view";

const asset = (id: string, name = id): AssetInfo => ({ id, name, url: `/api/assets/${id}` });

const assets = [
  asset("a.svg", "alpha"),
  asset("b.svg", "beta"),
  asset("c.svg", "gamma"),
  asset("d.png", "Delta"),
];
const folders = ["sponsors", "clubs"];
const assetFolders = { "a.svg": "sponsors", "b.svg": "sponsors", "c.svg": "clubs" };

describe("folderCounts", () => {
  it("counts every folder, including empty ones", () => {
    expect(folderCounts(assets, assetFolders, [...folders, "empty"])).toEqual({
      all: 4,
      unfiled: 1,
      byFolder: { sponsors: 2, clubs: 1, empty: 0 },
    });
  });

  it("counts assets in a folder that no longer exists as unfiled", () => {
    expect(folderCounts(assets, assetFolders, ["sponsors"])).toEqual({
      all: 4,
      unfiled: 2,
      byFolder: { sponsors: 2 },
    });
  });

  it("handles an empty library", () => {
    expect(folderCounts([], {}, [])).toEqual({ all: 0, unfiled: 0, byFolder: {} });
  });
});

describe("filterAssets", () => {
  it("returns everything for the All filter", () => {
    expect(filterAssets(assets, assetFolders, folders, null, "")).toHaveLength(4);
  });

  it("returns one folder's assets", () => {
    expect(filterAssets(assets, assetFolders, folders, "sponsors", "").map((a) => a.id)).toEqual([
      "a.svg",
      "b.svg",
    ]);
  });

  it("returns unfiled assets", () => {
    expect(filterAssets(assets, assetFolders, folders, "", "").map((a) => a.id)).toEqual(["d.png"]);
  });

  it("shows assets stranded in a deleted folder as unfiled, matching the counts", () => {
    const stranded = filterAssets(assets, assetFolders, ["sponsors"], "", "");
    expect(stranded.map((a) => a.id)).toEqual(["c.svg", "d.png"]);
    expect(stranded).toHaveLength(folderCounts(assets, assetFolders, ["sponsors"]).unfiled);
  });

  it("searches by name, case-insensitively, and ignores surrounding space", () => {
    expect(filterAssets(assets, assetFolders, folders, null, "  DEL ").map((a) => a.id)).toEqual([
      "d.png",
    ]);
  });

  it("combines a folder and a search", () => {
    expect(filterAssets(assets, assetFolders, folders, "sponsors", "bet").map((a) => a.id)).toEqual([
      "b.svg",
    ]);
  });
});
