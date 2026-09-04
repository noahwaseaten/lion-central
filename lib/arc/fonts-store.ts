import { promises as fs } from "node:fs";
import path from "node:path";

import { type FontAssetInfo, isFontFilename, isValidFontId } from "./fonts-shared";

export type { FontAssetInfo };
export { fontContentTypeFor, isValidFontId } from "./fonts-shared";

/**
 * Server-side custom-font store (LOCAL ONLY), mirroring `assets-store.ts`.
 * Uploaded font files are written to a directory on disk; a sidecar JSON file
 * tracks each id's original filename, chosen font-family name, and upload
 * time (font files have no reliable list-order source of their own, unlike
 * images/videos which are sorted by mtime).
 *
 * Location: `FONTS_DIR` env, else `<cwd>/.lion-fonts`.
 */
function fontsDir(): string {
  return process.env.FONTS_DIR || path.join(process.cwd(), ".lion-fonts");
}

function metaPath(): string {
  return path.join(fontsDir(), "_fonts.json");
}

interface FontMeta {
  name: string;
  family: string;
  t: number;
}

async function readMeta(): Promise<Record<string, FontMeta>> {
  try {
    const raw = await fs.readFile(metaPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, FontMeta>) : {};
  } catch {
    return {};
  }
}

async function writeMeta(meta: Record<string, FontMeta>): Promise<void> {
  await fs.mkdir(fontsDir(), { recursive: true });
  await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2));
}

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const EXT_FROM_MIME: Record<string, string> = {
  "font/otf": ".otf",
  "font/ttf": ".ttf",
  "font/woff": ".woff",
  "font/woff2": ".woff2",
  "application/font-sfnt": ".ttf",
  "application/x-font-opentype": ".otf",
  "application/x-font-truetype": ".ttf",
  "application/octet-stream": "",
};

/** List stored fonts, newest first. Returns [] if nothing's been uploaded. */
export async function listFonts(): Promise<FontAssetInfo[]> {
  const meta = await readMeta();
  return Object.entries(meta)
    .sort(([, a], [, b]) => b.t - a.t)
    .map(([id, m]) => ({ id, name: m.name, family: m.family, url: `/api/fonts/${id}` }));
}

/** Decode a data URL and store it as a font; returns the new font asset. */
export async function saveFontDataUrl(dataUrl: string, filename: string, family: string): Promise<FontAssetInfo> {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Not a data URL");
  const [, mime, isBase64, payload] = match;

  if (!isFontFilename(filename)) throw new Error("Not a supported font file (.otf/.ttf/.woff/.woff2)");
  const ext = path.extname(filename).toLowerCase() || EXT_FROM_MIME[mime] || "";
  if (!ext) throw new Error("Not a supported font file (.otf/.ttf/.woff/.woff2)");

  const id = `${randomToken()}${ext}`;
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  const dir = fontsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, id), buffer);

  const meta = await readMeta();
  meta[id] = { name: filename, family, t: Date.now() };
  await writeMeta(meta);

  return { id, name: filename, family, url: `/api/fonts/${id}` };
}

/** Read a font's bytes, or null if it doesn't exist. */
export async function readFont(id: string): Promise<Buffer | null> {
  if (!isValidFontId(id)) return null;
  try {
    return await fs.readFile(path.join(fontsDir(), id));
  } catch {
    return null;
  }
}

/** Delete a font; resolves whether or not it existed. */
export async function deleteFont(id: string): Promise<void> {
  if (!isValidFontId(id)) return;
  await fs.rm(path.join(fontsDir(), id), { force: true });
  const meta = await readMeta();
  if (id in meta) {
    delete meta[id];
    await writeMeta(meta);
  }
}
