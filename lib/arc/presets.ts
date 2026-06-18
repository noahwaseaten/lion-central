import type { ZoneContent } from "./content";
import { SHOULDER_W, TOP_BAR } from "./layout";
import { type ArcConfig, defaultConfig, makeComponent } from "./layout-model";

/** A named full-layout snapshot the operator can switch to. */
export interface Preset {
  id: string;
  name: string;
  config: ArcConfig;
}

const sponsorsGrid = (): ZoneContent => ({
  type: "sponsors",
  items: [],
  mode: "grid",
  intervalMs: 5000,
  columns: "auto",
  cellPadding: 0.12,
});

/** "Feed off" — the default layout with the top-bar feed swapped for sponsors. */
function feedOff(): ArcConfig {
  const c = defaultConfig();
  c.surfaces.topbar = c.surfaces.topbar.map((comp) =>
    comp.content.type === "feed" ? makeComponent(sponsorsGrid(), comp.rect) : comp,
  );
  return c;
}

const SHOULDER_FRAC = SHOULDER_W / TOP_BAR.w; // ≈ 0.246

/**
 * "Sponsors populated" — the designer reference arrangement: shoulder sponsor stacks
 * + a center title/clock band on the top bar, and a vertical sponsor stack on each
 * leg. Ships the layout structure with empty sponsor grids; the operator fills logos
 * from the shared library.
 */
function sponsorsPopulated(): ArcConfig {
  const c = defaultConfig();
  c.surfaces.topbar = [
    makeComponent(sponsorsGrid(), { x: 0, y: 0, w: SHOULDER_FRAC, h: 1 }, "Left shoulder"),
    makeComponent(
      { type: "text", title: "Olympic Cross Triathlon", subtitle: "" },
      { x: SHOULDER_FRAC, y: 0, w: 1 - SHOULDER_FRAC * 2, h: 1 },
      "Title",
    ),
    makeComponent(sponsorsGrid(), { x: 1 - SHOULDER_FRAC, y: 0, w: SHOULDER_FRAC, h: 1 }, "Right shoulder"),
  ];
  c.surfaces["leg-left"] = [makeComponent(sponsorsGrid(), { x: 0, y: 0, w: 1, h: 1 }, "Left sponsors")];
  c.surfaces["leg-right"] = [makeComponent(sponsorsGrid(), { x: 0, y: 0, w: 1, h: 1 }, "Right sponsors")];
  return c;
}

/** Built-in presets, always available and never editable. */
export const BUILTIN_PRESETS: Preset[] = [
  { id: "builtin:live-feed", name: "Live feed", config: defaultConfig() },
  { id: "builtin:feed-off", name: "Feed off", config: feedOff() },
  { id: "builtin:sponsors-populated", name: "Sponsors populated", config: sponsorsPopulated() },
];

export function isBuiltin(id: string): boolean {
  return id.startsWith("builtin:");
}
