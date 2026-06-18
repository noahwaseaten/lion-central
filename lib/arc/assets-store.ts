import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Server-side logo/asset store (LOCAL ONLY). Uploaded logos are written to a
 * directory on disk and served back by id, so they persist across browser tabs
 * and any device pointing at this server — unlike per-browser data URLs.
 *
 * Location: `ASSETS_DIR` env, else `<cwd>/.lion-assets`.
 */
function assetsDir(): string {
  return process.env.ASSETS_DIR || path.join(process.cwd(), ".lion-assets");
}

export interface AssetInfo {
  id: string;
  name: string;
  url: string;
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Reject ids that could escape the assets directory. */
export function isValidAssetId(id: string): boolean {
  return ID_RE.test(id) && !id.includes("..");
}

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

export function contentTypeFor(id: string): string {
  return CONTENT_TYPES[path.extname(id).toLowerCase()] ?? "application/octet-stream";
}

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

export function isVideoAsset(id: string): boolean {
  return VIDEO_EXTS.has(path.extname(id).toLowerCase());
}

const EXT_FROM_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

function randomToken(): string {
  // Local-only; uniqueness, not cryptographic strength, is what matters.
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** The original name after the `<token>__` prefix (for display). */
function displayName(id: string): string {
  const i = id.indexOf("__");
  return i >= 0 ? id.slice(i + 2) : id;
}

/** List stored assets, newest first. Returns [] if nothing's been uploaded. */
export async function listAssets(): Promise<AssetInfo[]> {
  const dir = assetsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const withTime = await Promise.all(
    entries
      .filter((f) => {
        const ct = contentTypeFor(f);
        return ct.startsWith("image/") || ct.startsWith("video/");
      })
      .map(async (f) => {
        const stat = await fs.stat(path.join(dir, f)).catch(() => null);
        return { id: f, name: displayName(f), url: `/api/assets/${f}`, t: stat?.mtimeMs ?? 0 };
      }),
  );
  return withTime.sort((a, b) => b.t - a.t).map(({ id, name, url }) => ({ id, name, url }));
}

/** Decode a data URL and store it; returns the new asset. */
export async function saveDataUrl(dataUrl: string, name: string): Promise<AssetInfo> {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Not a data URL");
  const [, mime, isBase64, payload] = match;
  const ext = EXT_FROM_MIME[mime] ?? path.extname(name).toLowerCase() ?? ".png";
  const base = (name.replace(/\.[^.]+$/, "") || "logo")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const id = `${randomToken()}__${base || "logo"}${ext}`;
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  const dir = assetsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, id), buffer);
  return { id, name: displayName(id), url: `/api/assets/${id}` };
}

/** Read an asset's bytes, or null if it doesn't exist. */
export async function readAsset(id: string): Promise<Buffer | null> {
  if (!isValidAssetId(id)) return null;
  try {
    return await fs.readFile(path.join(assetsDir(), id));
  } catch {
    return null;
  }
}

/** Delete an asset; resolves whether or not it existed. */
export async function deleteAsset(id: string): Promise<void> {
  if (!isValidAssetId(id)) return;
  await fs.rm(path.join(assetsDir(), id), { force: true });
}
