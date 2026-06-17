import { defaultContent, normalizeContent, type ZoneContent } from "./content";
import { SHOULDER_W, TOP_BAR } from "./layout";
import { isSurfaceId, type SurfaceId, SURFACE_IDS } from "./surfaces";

/** A rect normalized to its owning surface — each field is a 0–1 fraction. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A selected component, identified by its surface and id. */
export interface Selection {
  surface: SurfaceId;
  id: string;
}

/** One component placed on a surface canvas. */
export interface ArcComponent {
  id: string;
  /** Optional operator label; falls back to the content type's label. */
  name?: string;
  content: ZoneContent;
  /** Position + size, normalized to the owning surface. */
  rect: NormRect;
}

/**
 * The full arc configuration: every surface's ordered list of components.
 * Array order is paint / z order — the last component draws on top. Persisted to
 * localStorage and synced across tabs so an operator change updates every output.
 */
export interface ArcConfig {
  /** Arc surface background (the physical arc is white). */
  background: string;
  surfaces: Record<SurfaceId, ArcComponent[]>;
}

let idSeq = 0;
/** A stable-enough unique id for a component. */
export function newId(): string {
  idSeq += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 1e9).toString(36);
  return `c_${rand}_${idSeq}`;
}

/** Build a component with a fresh id from a content value and a rect. */
export function makeComponent(content: ZoneContent, rect: NormRect, name?: string): ArcComponent {
  return { id: newId(), content, rect, ...(name ? { name } : {}) };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Clamp a rect to its surface, keeping a minimum on-screen size. */
export function clampRect(rect: NormRect, min = 0.04): NormRect {
  const w = Math.min(1, Math.max(min, rect.w));
  const h = Math.min(1, Math.max(min, rect.h));
  return { w, h, x: clamp01(Math.min(rect.x, 1 - w)), y: clamp01(Math.min(rect.y, 1 - h)) };
}

const sponsors = (mode: "rotate" | "grid"): ZoneContent => ({
  type: "sponsors",
  images: [],
  mode,
  intervalMs: 5000,
  columns: "auto",
  cellPadding: 0.12,
});

const SHOULDER_FRAC = SHOULDER_W / TOP_BAR.w; // ≈ 0.246

/** Out-of-the-box layout: shoulders flank a full-height feed, legs are logo walls. */
export function defaultConfig(): ArcConfig {
  return {
    background: "#ffffff",
    surfaces: {
      clock: [makeComponent(defaultContent("clock"), { x: 0, y: 0, w: 1, h: 1 })],
      topbar: [
        makeComponent(sponsors("rotate"), { x: 0, y: 0, w: SHOULDER_FRAC, h: 1 }, "Left shoulder"),
        makeComponent(defaultContent("feed"), {
          x: SHOULDER_FRAC,
          y: 0,
          w: 1 - SHOULDER_FRAC * 2,
          h: 1,
        }),
        makeComponent(
          sponsors("rotate"),
          { x: 1 - SHOULDER_FRAC, y: 0, w: SHOULDER_FRAC, h: 1 },
          "Right shoulder",
        ),
      ],
      "leg-left": [makeComponent(sponsors("grid"), { x: 0, y: 0, w: 1, h: 1 })],
      "leg-right": [makeComponent(sponsors("grid"), { x: 0, y: 0, w: 1, h: 1 })],
    },
  };
}

export const DEFAULT_ARC_CONFIG: ArcConfig = defaultConfig();

// ---- migration -------------------------------------------------------------

/** Legacy fixed-zone → (surface, normalized rect) table for migrating old configs. */
const LEGACY_ZONES: Record<string, { surface: SurfaceId; rect: NormRect } | null> = {
  "clock-main": { surface: "clock", rect: { x: 0, y: 0, w: 1, h: 1 } },
  "shoulder-left": { surface: "topbar", rect: { x: 0, y: 0, w: SHOULDER_FRAC, h: 1 } },
  feed: { surface: "topbar", rect: { x: SHOULDER_FRAC, y: 100 / 256, w: 1 - SHOULDER_FRAC * 2, h: 156 / 256 } },
  "shoulder-right": { surface: "topbar", rect: { x: 1 - SHOULDER_FRAC, y: 0, w: SHOULDER_FRAC, h: 1 } },
  "leg-left-panel": { surface: "leg-left", rect: { x: 0, y: 0, w: 1, h: 1 } },
  "leg-right-panel": { surface: "leg-right", rect: { x: 0, y: 0, w: 1, h: 1 } },
  brand: null, // retired — dropped on migration
};

function emptySurfaces(): Record<SurfaceId, ArcComponent[]> {
  return SURFACE_IDS.reduce(
    (acc, id) => {
      acc[id] = [];
      return acc;
    },
    {} as Record<SurfaceId, ArcComponent[]>,
  );
}

function normalizeRect(raw: unknown): NormRect {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown, f: number) => (typeof v === "number" && Number.isFinite(v) ? v : f);
  return clampRect({ x: n(r.x, 0), y: n(r.y, 0), w: n(r.w, 0.5), h: n(r.h, 0.5) });
}

/** Coerce a loosely-shaped component (persisted/preset) into a valid one. */
export function normalizeComponent(raw: unknown): ArcComponent {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof c.id === "string" ? c.id : newId(),
    ...(typeof c.name === "string" ? { name: c.name } : {}),
    content: normalizeContent(c.content),
    rect: normalizeRect(c.rect),
  };
}

/**
 * Bring any persisted/preset config to the current shape:
 * - new shape (`surfaces`) → normalize each component;
 * - legacy shape (`zones`) → convert each zone to a component (brand dropped);
 * - anything else → the default layout.
 */
export function migrate(parsed: unknown): ArcConfig {
  if (!parsed || typeof parsed !== "object") return defaultConfig();
  const p = parsed as Record<string, unknown>;
  const background = typeof p.background === "string" ? p.background : "#ffffff";

  if (p.surfaces && typeof p.surfaces === "object") {
    const surfaces = emptySurfaces();
    for (const [id, list] of Object.entries(p.surfaces as Record<string, unknown>)) {
      if (isSurfaceId(id) && Array.isArray(list)) {
        surfaces[id] = list.map(normalizeComponent);
      }
    }
    return { background, surfaces };
  }

  if (p.zones && typeof p.zones === "object") {
    const surfaces = emptySurfaces();
    for (const [zoneId, content] of Object.entries(p.zones as Record<string, unknown>)) {
      const map = LEGACY_ZONES[zoneId];
      if (!map) continue; // unknown or retired (brand)
      surfaces[map.surface].push(makeComponent(normalizeContent(content), map.rect));
    }
    // Any surface the old config didn't cover keeps the default layout.
    const fallback = defaultConfig();
    for (const id of SURFACE_IDS) if (surfaces[id].length === 0) surfaces[id] = fallback.surfaces[id];
    return { background, surfaces };
  }

  return { ...defaultConfig(), background };
}
