export interface FontAssetInfo {
  id: string;
  /** Original uploaded filename, e.g. "RistrettoSlabPro-Regular.otf". */
  name: string;
  /** The font-family name to register and paint with. */
  family: string;
  url: string;
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isValidFontId(id: string): boolean {
  return ID_RE.test(id) && !id.includes("..");
}

function extname(id: string): string {
  const i = id.lastIndexOf(".");
  return i > 0 ? id.slice(i).toLowerCase() : "";
}

const CONTENT_TYPES: Record<string, string> = {
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function fontContentTypeFor(id: string): string {
  return CONTENT_TYPES[extname(id)] ?? "application/octet-stream";
}

export function isFontFilename(name: string): boolean {
  return extname(name) in CONTENT_TYPES;
}

/** A curated set of popular, freely-licensed Google Fonts for the picker's suggestions — any other Google Fonts name can still be typed in. */
export const GOOGLE_FONTS: string[] = [
  "Anton",
  "Archivo Black",
  "Bebas Neue",
  "Big Shoulders Display",
  "Bungee",
  "DM Sans",
  "Fjalla One",
  "Inter",
  "Kanit",
  "Lato",
  "Libre Franklin",
  "Montserrat",
  "Oswald",
  "Playfair Display",
  "Poppins",
  "Raleway",
  "Roboto Condensed",
  "Rubik",
  "Russo One",
  "Saira Condensed",
  "Space Grotesk",
  "Teko",
  "Work Sans",
];

/** A font-family name is only ever used inside a CSS font shorthand / Google Fonts URL — strip quotes/backslashes that could break out of either. */
export function sanitizeFontFamily(name: string): string {
  return name.replace(/["'\\]/g, "").trim().slice(0, 100);
}
