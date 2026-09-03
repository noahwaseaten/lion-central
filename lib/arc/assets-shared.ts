export interface AssetInfo {
  id: string;
  name: string;
  url: string;
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isValidAssetId(id: string): boolean {
  return ID_RE.test(id) && !id.includes("..");
}

function extname(id: string): string {
  const i = id.lastIndexOf(".");
  return i > 0 ? id.slice(i).toLowerCase() : "";
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
  return CONTENT_TYPES[extname(id)] ?? "application/octet-stream";
}

/**
 * The readable name for a stored asset, from either its id or its URL.
 *
 * Stored ids carry a random uniqueness token (`k3f9x2b1__sportdepot.svg`).
 * Showing that raw in the UI is unreadable, so strip the path and the token and
 * leave the name the operator uploaded.
 */
export function assetDisplayName(idOrUrl: string): string {
  const file = idOrUrl.split(/[?#]/)[0].split("/").pop() ?? "";
  const i = file.indexOf("__");
  const name = i >= 0 ? file.slice(i + 2) : file;
  return name || idOrUrl;
}

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

export function isVideoAsset(id: string): boolean {
  return VIDEO_EXTS.has(extname(id));
}
