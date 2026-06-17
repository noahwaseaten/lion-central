import type { ZoneContent } from "./content";
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

/** Built-in presets, always available and never editable. */
export const BUILTIN_PRESETS: Preset[] = [
  { id: "builtin:live-feed", name: "Live feed", config: defaultConfig() },
  { id: "builtin:feed-off", name: "Feed off", config: feedOff() },
];

export function isBuiltin(id: string): boolean {
  return id.startsWith("builtin:");
}
