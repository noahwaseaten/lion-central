import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultConfig } from "./layout-model";
import { readPresets, writePresets } from "./presets-store";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lion-test-"));
  process.env.PRESETS_DIR = tmpDir;
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.PRESETS_DIR;
});

describe("readPresets", () => {
  it("returns [] when no presets.json exists", async () => {
    expect(await readPresets()).toEqual([]);
  });

  it("returns [] for invalid JSON", async () => {
    await fs.writeFile(path.join(tmpDir, "presets.json"), "not json");
    expect(await readPresets()).toEqual([]);
  });
});

describe("writePresets", () => {
  it("persists presets to disk and readPresets sees them back", async () => {
    const config = defaultConfig();
    await writePresets([{ id: "p1", name: "Race Day", config }]);
    const presets = await readPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe("p1");
    expect(presets[0].name).toBe("Race Day");
  });

  it("creates the presets dir if it does not exist", async () => {
    const nested = path.join(tmpDir, "sub");
    process.env.PRESETS_DIR = nested;
    await writePresets([{ id: "p1", name: "Race Day", config: defaultConfig() }]);
    expect(await readPresets()).toHaveLength(1);
  });

  it("replaces the whole list rather than merging", async () => {
    await writePresets([{ id: "p1", name: "One", config: defaultConfig() }]);
    await writePresets([{ id: "p2", name: "Two", config: defaultConfig() }]);
    const presets = await readPresets();
    expect(presets.map((p) => p.id)).toEqual(["p2"]);
  });

  it("drops malformed entries and fills in missing ids/names", async () => {
    await writePresets([null, "garbage", { name: "No id", config: defaultConfig() }]);
    const presets = await readPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe("No id");
    expect(typeof presets[0].id).toBe("string");
    expect(presets[0].id.length).toBeGreaterThan(0);
  });
});
