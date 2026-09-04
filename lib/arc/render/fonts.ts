/**
 * Browser-only font loader for the canvas compositor. Google/custom fonts are
 * kicked off once per family and cached; painters call `resolveFont` every
 * frame and get the system font back immediately while a web font is still
 * loading — the surface's continuous render loop (see `useSurfaceCanvas`)
 * naturally repaints with the real font a few frames later once it lands, no
 * extra invalidation needed.
 */

import type { FontChoice } from "../content";
import { sanitizeFontFamily } from "../fonts-shared";

export const SYSTEM_FONT = "Inter, system-ui, sans-serif";

const googleRequested = new Set<string>();
type CustomState = "loading" | "loaded" | "error";
const customState = new Map<string, CustomState>();

function googleFontsHref(family: string): string {
  const q = encodeURIComponent(family).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${q}:wght@400;500;600;700;800&display=swap`;
}

/**
 * Ensure the given font choice is loaded (kicking off the load on first use)
 * and return the CSS font-family value painters should set on `ctx.font`.
 */
export function resolveFont(font: FontChoice | undefined): string {
  if (!font || font.source === "system" || typeof document === "undefined") return SYSTEM_FONT;

  const family = sanitizeFontFamily(font.family);
  if (!family) return SYSTEM_FONT;
  const quoted = `"${family}", ${SYSTEM_FONT}`;

  if (font.source === "google") {
    if (!googleRequested.has(family)) {
      googleRequested.add(family);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = googleFontsHref(family);
      document.head.appendChild(link);
      void document.fonts.load(`800 16px "${family}"`).catch(() => {});
    }
    return document.fonts.check(`800 16px "${family}"`) ? quoted : SYSTEM_FONT;
  }

  // Custom, operator-uploaded font file.
  const key = `${family}::${font.url}`;
  if (!customState.has(key)) {
    customState.set(key, "loading");
    const face = new FontFace(family, `url(${JSON.stringify(font.url)})`);
    document.fonts.add(face);
    face.load().then(
      () => customState.set(key, "loaded"),
      () => customState.set(key, "error"),
    );
  }
  return customState.get(key) === "loaded" ? quoted : SYSTEM_FONT;
}
