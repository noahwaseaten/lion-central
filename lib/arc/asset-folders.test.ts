import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createFolder,
  deleteFolder,
  moveAsset,
  readFolderMeta,
  renameFolder,
} from "./asset-folders";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lion-test-"));
  process.env.ASSETS_DIR = tmpDir;
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.ASSETS_DIR;
});

describe("readFolderMeta", () => {
  it("returns empty meta when no _folders.json exists", async () => {
    const meta = await readFolderMeta();
    expect(meta).toEqual({ folders: [], assetFolders: {} });
  });

  it("returns empty meta for invalid JSON", async () => {
    await fs.writeFile(path.join(tmpDir, "_folders.json"), "not json");
    const meta = await readFolderMeta();
    expect(meta).toEqual({ folders: [], assetFolders: {} });
  });
});

describe("createFolder", () => {
  it("adds a folder name", async () => {
    await createFolder("Sponsors");
    const meta = await readFolderMeta();
    expect(meta.folders).toContain("Sponsors");
  });

  it("is idempotent — duplicate create does not double-add", async () => {
    await createFolder("Sponsors");
    await createFolder("Sponsors");
    const meta = await readFolderMeta();
    expect(meta.folders.filter((f) => f === "Sponsors")).toHaveLength(1);
  });

  it("creates the assets dir if it does not exist", async () => {
    const nested = path.join(tmpDir, "sub");
    process.env.ASSETS_DIR = nested;
    await createFolder("Test");
    const meta = await readFolderMeta();
    expect(meta.folders).toContain("Test");
  });
});

describe("renameFolder", () => {
  it("renames folder and updates asset assignments", async () => {
    await createFolder("Old");
    await moveAsset("logo.png", "Old");
    await renameFolder("Old", "New");
    const meta = await readFolderMeta();
    expect(meta.folders).toContain("New");
    expect(meta.folders).not.toContain("Old");
    expect(meta.assetFolders["logo.png"]).toBe("New");
  });

  it("is a no-op for unknown folder", async () => {
    await renameFolder("Ghost", "New");
    const meta = await readFolderMeta();
    expect(meta.folders).not.toContain("New");
  });
});

describe("deleteFolder", () => {
  it("removes folder and unfiles its assets", async () => {
    await createFolder("ToDelete");
    await moveAsset("logo.png", "ToDelete");
    await deleteFolder("ToDelete");
    const meta = await readFolderMeta();
    expect(meta.folders).not.toContain("ToDelete");
    expect(meta.assetFolders["logo.png"]).toBeUndefined();
  });
});

describe("moveAsset", () => {
  it("assigns asset to folder", async () => {
    await createFolder("Sponsors");
    await moveAsset("logo.png", "Sponsors");
    const meta = await readFolderMeta();
    expect(meta.assetFolders["logo.png"]).toBe("Sponsors");
  });

  it("unfiles asset when folder is null", async () => {
    await createFolder("Sponsors");
    await moveAsset("logo.png", "Sponsors");
    await moveAsset("logo.png", null);
    const meta = await readFolderMeta();
    expect(meta.assetFolders["logo.png"]).toBeUndefined();
  });

  it("overwrites a prior folder assignment", async () => {
    await createFolder("A");
    await createFolder("B");
    await moveAsset("logo.png", "A");
    await moveAsset("logo.png", "B");
    const meta = await readFolderMeta();
    expect(meta.assetFolders["logo.png"]).toBe("B");
  });
});
