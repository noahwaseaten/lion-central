import { appendFile, open, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { NO_OFFSETS } from "./offsets";
import { parseLines } from "./parse";
import type { FeedOffsets, FeedSnapshot } from "./types";

/**
 * Resolve `name` strictly within `dir`, rejecting path traversal / escapes.
 * Throws on any attempt to reach outside the base directory.
 */
export function safeResolve(dir: string, name: string): string {
  const base = path.resolve(dir);
  const target = path.resolve(base, name);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error("Path escapes the feed directory");
  }
  return target;
}

/**
 * Read the tail of a file cheaply: only the last `maxBytes` bytes, decoded and
 * split into lines. The first line may be partial (cut mid-write) — callers
 * parse tolerantly, so a partial leading line is simply skipped.
 */
export async function readLastLines(
  filePath: string,
  maxBytes = 16_384,
): Promise<string[]> {
  const handle = await open(filePath, "r");
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, maxBytes);
    const position = size - length;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, position);
    return buffer
      .toString("utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } finally {
    await handle.close();
  }
}

/** List `.txt` files in `dir`, newest (by mtime) first. */
export async function listTxtFiles(
  dir: string,
): Promise<{ name: string; mtimeMs: number }[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
      .map(async (e) => {
        const s = await stat(path.join(dir, e.name));
        return { name: e.name, mtimeMs: s.mtimeMs };
      }),
  );
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * Append a single line (newline-terminated) to a feed file within `dir`. Used by
 * the local-only test tool; path-guarded like every other feed access.
 */
export async function appendLine(dir: string, name: string, line: string): Promise<void> {
  const filePath = safeResolve(dir, name);
  await appendFile(filePath, line.endsWith("\n") ? line : `${line}\n`, "utf8");
}

/** Read + parse the current snapshot (last `count` valid athletes, newest-first). */
export async function readSnapshot(
  dir: string,
  name: string,
  count: number,
  offsets: FeedOffsets = NO_OFFSETS,
): Promise<FeedSnapshot> {
  const filePath = safeResolve(dir, name);
  const [lines, s] = await Promise.all([
    readLastLines(filePath),
    stat(filePath),
  ]);
  return { entries: parseLines(lines, count, offsets), fileMtimeMs: s.mtimeMs };
}
