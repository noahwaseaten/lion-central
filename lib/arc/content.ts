/** Object-fit behaviour for image/video components. */
export type Fit = "contain" | "cover";

/** Crop/place transform shared by image components and individual sponsor logos. */
export interface ImageTransform {
  fit: Fit;
  /** Multiplier on the fit baseline — 1 fits the frame, >1 zooms in / crops. */
  scale: number;
  /** Pan, as a fraction of the inner frame (0,0 = centered). */
  offset: { x: number; y: number };
  /** Inset, as a fraction of the frame's short edge (0–0.4). */
  padding: number;
  /** Solid fill behind the image (for white/transparent logos); null = none. */
  background: string | null;
}

/** One sponsor logo: a source plus its own crop/place transform. */
export interface SponsorItem extends ImageTransform {
  src: string;
}

/** A default (identity) transform: contain-fit, no zoom/pan/padding, no background. */
export function defaultTransform(): ImageTransform {
  return { fit: "contain", scale: 1, offset: { x: 0, y: 0 }, padding: 0, background: null };
}

/**
 * What a component displays. The canvas compositor renders one of these per
 * placed component, so the same content shows on the 2D workspace stage and on
 * the physical output.
 */
export type ZoneContent =
  | { type: "feed" }
  | { type: "clock"; numberFlow: boolean }
  | { type: "text"; title: string; subtitle?: string }
  | {
      type: "sponsors";
      /** Per-logo source + crop transform; array order = grid / rotate order. */
      items: SponsorItem[];
      mode: "rotate" | "grid";
      intervalMs: number;
      /** Grid columns; "auto" picks near-square cells from the component aspect. */
      columns: number | "auto";
      /** Baseline inset per cell, as a fraction of the cell's short edge (0–0.4). */
      cellPadding: number;
    }
  | ({ type: "image"; src: string } & ImageTransform)
  | { type: "video"; src: string; loop: boolean; muted: boolean; fit: Fit }
  | { type: "color"; color: string }
  | { type: "qr"; url: string; label: string }
  | { type: "off" };

export type ContentType = ZoneContent["type"];

export const CONTENT_TYPES: { type: ContentType; label: string }[] = [
  { type: "feed", label: "Live feed" },
  { type: "clock", label: "Race clock" },
  { type: "text", label: "Custom text" },
  { type: "sponsors", label: "Sponsors" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "qr", label: "QR Code" },
  { type: "color", label: "Solid color" },
  { type: "off", label: "Off (blank)" },
];

/** A sensible default value for each content type (used when switching types). */
export function defaultContent(type: ContentType): ZoneContent {
  switch (type) {
    case "feed":
      return { type: "feed" };
    case "clock":
      return { type: "clock", numberFlow: false };
    case "text":
      return { type: "text", title: "Title", subtitle: "" };
    case "sponsors":
      return {
        type: "sponsors",
        items: [],
        mode: "grid",
        intervalMs: 5000,
        columns: "auto",
        cellPadding: 0.12,
      };
    case "image":
      return { type: "image", src: "", ...defaultTransform() };
    case "video":
      return { type: "video", src: "", loop: true, muted: true, fit: "cover" };
    case "color":
      return { type: "color", color: "#0284c7" };
    case "qr":
      return { type: "qr", url: "", label: "Scan for results" };
    case "off":
      return { type: "off" };
  }
}

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

const clampFrac = (v: number): number => (v < 0 ? 0 : v > 0.4 ? 0.4 : v);

/** Coerce loose data into a complete ImageTransform, back-filling missing fields. */
function normalizeTransform(raw: Record<string, unknown>): ImageTransform {
  const off = (raw.offset ?? {}) as Record<string, unknown>;
  return {
    fit: raw.fit === "cover" ? "cover" : "contain",
    scale: Math.max(0.1, num(raw.scale, 1)),
    offset: { x: num(off.x, 0), y: num(off.y, 0) },
    padding: clampFrac(num(raw.padding, 0)),
    background: typeof raw.background === "string" ? raw.background : null,
  };
}

/**
 * Coerce loosely-shaped (persisted, older, or preset) content into a complete,
 * valid `ZoneContent`, back-filling fields added after it was saved. Unknown or
 * removed types (e.g. the retired "brand") fall back to a Text component so a
 * stale config never renders broken.
 */
export function normalizeContent(raw: unknown): ZoneContent {
  if (!raw || typeof raw !== "object" || !("type" in raw)) return defaultContent("off");
  const c = raw as Record<string, unknown>;

  switch (c.type) {
    case "feed":
      return { type: "feed" };
    case "clock":
      return { type: "clock", numberFlow: c.numberFlow === true };
    case "off":
      return { type: "off" };
    case "color":
      return { type: "color", color: typeof c.color === "string" ? c.color : "#0284c7" };
    case "text":
      return {
        type: "text",
        title: typeof c.title === "string" ? c.title : "Title",
        subtitle: typeof c.subtitle === "string" ? c.subtitle : "",
      };
    case "sponsors": {
      // Accept new `items` or legacy `images: string[]`; both produce SponsorItem[].
      const rawItems = Array.isArray(c.items)
        ? c.items
        : Array.isArray(c.images)
          ? (c.images as unknown[]).map((src) => ({ src }))
          : [];
      const items: SponsorItem[] = rawItems
        .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>) : {}))
        .filter((it) => typeof it.src === "string" && it.src.length > 0)
        .map((it) => ({ src: str(it.src), ...normalizeTransform(it) }));
      return {
        type: "sponsors",
        items,
        mode: c.mode === "rotate" ? "rotate" : "grid",
        intervalMs: num(c.intervalMs, 5000),
        columns: c.columns === "auto" || c.columns === undefined ? "auto" : Math.max(1, num(c.columns, 1)),
        cellPadding: clampFrac(num(c.cellPadding, 0.12)),
      };
    }
    case "image":
      return { type: "image", src: str(c.src), ...normalizeTransform(c) };
    case "video":
      return {
        type: "video",
        src: typeof c.src === "string" ? c.src : "",
        loop: c.loop !== false,
        muted: c.muted !== false,
        fit: c.fit === "contain" ? "contain" : "cover",
      };
    case "qr":
      return {
        type: "qr",
        url: typeof c.url === "string" ? c.url : "",
        label: typeof c.label === "string" && c.label.length > 0 ? c.label : "Scan for results",
      };
    default:
      // Retired or unknown type (e.g. legacy "brand").
      return defaultContent("text");
  }
}

export type { ArcComponent, ArcConfig, NormRect } from "./layout-model";
export { DEFAULT_ARC_CONFIG } from "./layout-model";
