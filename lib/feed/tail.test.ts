import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listTxtFiles, readLastLines, readSnapshot, safeResolve } from "./tail";

describe("safeResolve", () => {
  it("resolves a plain filename within the base dir", () => {
    const base = path.resolve("/feeds");
    expect(safeResolve("/feeds", "race.txt")).toBe(path.join(base, "race.txt"));
  });

  it("rejects path traversal", () => {
    expect(() => safeResolve("/feeds", "../secret.txt")).toThrow();
    expect(() => safeResolve("/feeds", "../../etc/passwd")).toThrow();
  });
});

describe("tail file IO", () => {
  let dir: string;
  let file: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "lion-feed-"));
    file = path.join(dir, "race.txt");
    const lines = Array.from({ length: 50 }, (_, i) => `10${i} NAME${i} LAST${i} 0${i % 6}:30:00`);
    await writeFile(file, lines.join("\n") + "\n", "utf8");
    await writeFile(path.join(dir, "notes.md"), "ignore me", "utf8");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads only the tail lines", async () => {
    const lines = await readLastLines(file, 64);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[lines.length - 1]).toContain("1049");
  });

  it("lists only .txt files", async () => {
    const files = await listTxtFiles(dir);
    expect(files.map((f) => f.name)).toEqual(["race.txt"]);
  });

  it("reads a parsed snapshot newest-first", async () => {
    const snap = await readSnapshot(dir, "race.txt", 3);
    expect(snap.entries).toHaveLength(3);
    expect(snap.entries[0].bib).toBe("1049");
    expect(snap.fileMtimeMs).toBeGreaterThan(0);
  });
});
