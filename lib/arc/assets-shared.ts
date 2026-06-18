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

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

export function isVideoAsset(id: string): boolean {
  return VIDEO_EXTS.has(extname(id));
}
