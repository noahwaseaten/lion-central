import { promises as fs } from "node:fs";
import path from "node:path";

import { migrate, newId } from "./layout-model";
import type { Preset } from "./presets";

/**
 * Server-side preset store (LOCAL ONLY), mirroring `assets-store.ts` /
 * `fonts-store.ts`. Saved layouts are written to a JSON file on disk instead
 * of localStorage, so `git pull` gives every machine running this app the
 * same saved layouts — a browser's localStorage never leaves that browser.
 *
 * Location: `PRESETS_DIR` env, else `<cwd>/.lion-presets`.
 */
function presetsDir(): string {
  return process.env.PRESETS_DIR || path.join(process.cwd(), ".lion-presets");
}

function presetsPath(): string {
  return path.join(presetsDir(), "presets.json");
}

/** Coerce arbitrary JSON into a valid preset list, dropping anything malformed. */
function coerce(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is { id?: unknown; name?: unknown; config?: unknown } => !!p && typeof p === "object")
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : newId(),
      name: typeof p.name === "string" ? p.name : "Untitled",
      config: migrate(p.config),
    }));
}

/** Read the saved presets. Returns [] if none have been saved yet. */
export async function readPresets(): Promise<Preset[]> {
  try {
    const raw = await fs.readFile(presetsPath(), "utf8");
    return coerce(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Replace the saved presets in one shot — the operator's whole list is one unit. */
export async function writePresets(presets: unknown): Promise<Preset[]> {
  const coerced = coerce(presets);
  await fs.mkdir(presetsDir(), { recursive: true });
  await fs.writeFile(presetsPath(), JSON.stringify(coerced, null, 2));
  return coerced;
}
