import QRCode from "qrcode";

import { formatClock } from "@/lib/feed/format";
import type { Split } from "@/lib/feed/types";

import type { ZoneContent } from "../content";
import { getImage, getVideo } from "./assets";
import { tickerRows, type TickerRow } from "./feed-anim";
import type { SurfaceInputs } from "./inputs";
import { sponsorColumns, sponsorGrid } from "./sponsor-layout";

/** Per-URL QR module cache so matrix generation runs once per distinct URL. */
const qrCache = new Map<string, { data: Uint8Array; size: number }>();

function getQrMatrix(url: string): { data: Uint8Array; size: number } {
  let cached = qrCache.get(url);
  if (!cached) {
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    cached = { data: qr.modules.data, size: qr.modules.size };
    qrCache.set(url, cached);
  }
  return cached;
}

const FONT = "Inter, system-ui, sans-serif";

/** A region within a surface, in native px. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Target on-screen row height for the feed; row count adapts to the component. */
const FEED_ROW_PX = 62;

/** Split colors tuned for the white arc (matches :root tokens). */
export const SPLIT_COLOR: Record<Split, string> = {
  swim: "#0284c7",
  bike: "#ea580c",
  run: "#059669",
};
const SPLIT_LABEL: Record<Split, string> = { swim: "SWIM", bike: "BIKE", run: "RUN" };

/** Draw one component's content into its region. Local coords are translated to 0,0. */
export function drawComponent(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  content: ZoneContent,
  inputs: SurfaceInputs,
  tMs: number,
  componentId: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.translate(rect.x, rect.y);
  const { w, h } = rect;

  switch (content.type) {
    case "feed":
      paintFeed(ctx, w, h, inputs, tMs, componentId);
      break;
    case "clock":
      paintClock(ctx, w, h, inputs, content);
      break;
    case "text":
      paintText(ctx, w, h, content);
      break;
    case "sponsors":
      paintSponsors(ctx, w, h, content, tMs);
      break;
    case "image":
      paintImage(ctx, w, h, content);
      break;
    case "video":
      paintVideo(ctx, w, h, content);
      break;
    case "qr":
      paintQr(ctx, w, h, content);
      break;
    case "color":
      ctx.fillStyle = content.color;
      ctx.fillRect(0, 0, w, h);
      break;
    case "off":
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      break;
  }
  ctx.restore();
}

// ---- painters --------------------------------------------------------------

function feedRowCount(h: number): number {
  return Math.max(1, Math.min(6, Math.round(h / FEED_ROW_PX)));
}

function paintFeed(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inputs: SurfaceInputs,
  tMs: number,
  componentId: string,
): void {
  const { entries, status } = inputs.feed;
  const rowCount = feedRowCount(h);
  const rows = tickerRows(ctx.canvas, componentId, entries, rowCount, h, tMs);

  if (rows.length === 0) {
    if (status === "error" || status === "offline")
      return centerText(ctx, w, h, "Feed unavailable", "#9ca3af");
    if (status === "empty")
      return centerText(ctx, w, h, "Waiting for the first athlete…", "#9ca3af");
    return paintFeedSkeleton(ctx, w, h, rowCount);
  }

  const rowH = h / rowCount;
  for (const row of rows) paintFeedRow(ctx, w, rowH, row);

  // Soft fades at the top/bottom edges so rows dissolve as they glide past.
  paintEdgeFade(ctx, w, h, inputs.config.background || "#ffffff");
}

/** One ticker row: accent bar, bib, name, split label, time. */
function paintFeedRow(
  ctx: CanvasRenderingContext2D,
  w: number,
  rowH: number,
  row: TickerRow,
): void {
  const { entry: e, y, alpha, fresh } = row;
  if (alpha <= 0.01) return;
  const color = SPLIT_COLOR[e.split];
  const cy = y + rowH / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Freshness wash — a soft tint behind a just-arrived athlete that decays.
  if (fresh > 0) {
    ctx.fillStyle = hexA(color, 0.1 * fresh);
    ctx.fillRect(0, y + 1, w, rowH - 2);
  }

  // accent bar
  ctx.fillStyle = color;
  ctx.fillRect(0, y + 7, 5, rowH - 14);

  ctx.textBaseline = "middle";

  // bib
  ctx.fillStyle = color;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(e.bib, 22, cy);
  const bibW = ctx.measureText(e.bib).width;

  // time (right)
  ctx.fillStyle = "#6b7280";
  ctx.font = `600 19px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(e.timeRaw, w - 16, cy);
  const timeW = ctx.measureText(e.timeRaw).width;

  // split label (before time)
  ctx.fillStyle = color;
  ctx.font = `bold 13px ${FONT}`;
  const label = SPLIT_LABEL[e.split];
  const labelX = w - 28 - timeW;
  ctx.fillText(label, labelX, cy);
  const labelW = ctx.measureText(label).width;

  // name (fills the middle)
  ctx.fillStyle = "#0a0a0a";
  ctx.font = `700 23px ${FONT}`;
  ctx.textAlign = "left";
  const nameX = 34 + bibW;
  const nameMax = labelX - labelW - 16 - nameX;
  ctx.fillText(ellipsize(ctx, e.name, nameMax), nameX, cy);

  // row divider
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(y + rowH) + 0.5);
  ctx.lineTo(w, Math.round(y + rowH) + 0.5);
  ctx.stroke();

  ctx.restore();
}

/** Top & bottom gradient masks (in the surface background color). */
function paintEdgeFade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: string,
): void {
  const fade = Math.min(16, h * 0.12);
  const top = ctx.createLinearGradient(0, 0, 0, fade);
  top.addColorStop(0, bg);
  top.addColorStop(1, hexA(bg, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, fade);

  const bottom = ctx.createLinearGradient(0, h - fade, 0, h);
  bottom.addColorStop(0, hexA(bg, 0));
  bottom.addColorStop(1, bg);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, h - fade, w, fade);
}

function paintFeedSkeleton(ctx: CanvasRenderingContext2D, w: number, h: number, rowCount: number): void {
  const rowH = h / rowCount;
  const pulse = 0.5 + 0.5 * Math.sin(tNow() / 400);
  ctx.fillStyle = hexA("#9ca3af", 0.12 + pulse * 0.12);
  for (let i = 0; i < rowCount; i++) {
    const y = i * rowH + rowH / 2;
    ctx.fillRect(22, y - 9, 40, 18);
    ctx.fillRect(72, y - 11, w * 0.45, 22);
    ctx.fillRect(w - 90, y - 9, 74, 18);
  }
}

function paintClock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inputs: SurfaceInputs,
  content: Extract<ZoneContent, { type: "clock" }>,
): void {
  // NumberFlow clocks render as a DOM overlay (see SurfaceView); leave the canvas
  // region to the surface background so the two don't double up.
  if (content.numberFlow) return;
  const text = formatClock(inputs.clock.ms);
  const px = fitFont(ctx, text, w * 0.86, h * 0.74, "800");
  ctx.font = `800 ${px}px ${FONT}`;
  ctx.fillStyle = "#0a0a0a";
  ctx.globalAlpha = inputs.clock.running ? 1 : 0.5;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + px * 0.02);
  ctx.globalAlpha = 1;
}

function paintText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: Extract<ZoneContent, { type: "text" }>,
): void {
  const hasSub = !!content.subtitle?.trim();
  const titlePx = fitFont(ctx, content.title || " ", w * 0.92, hasSub ? h * 0.5 : h * 0.6, "800");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0a0a0a";
  ctx.font = `800 ${titlePx}px ${FONT}`;
  const ty = hasSub ? h * 0.4 : h * 0.5;
  ctx.fillText(content.title, w / 2, ty);

  if (hasSub) {
    const subPx = fitFont(ctx, content.subtitle!, w * 0.86, h * 0.3, "500");
    ctx.font = `500 ${subPx}px ${FONT}`;
    ctx.fillStyle = "#52525b";
    ctx.fillText(content.subtitle!, w / 2, h * 0.74);
  }
}

const LABEL_H_FRAC = 0.22;

function paintQr(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: Extract<ZoneContent, { type: "qr" }>,
): void {
  if (!content.url) return placeholder(ctx, 8, 8, w - 16, h - 16, "QR CODE");

  const { data, size } = getQrMatrix(content.url);
  const qrAreaH = h * (1 - LABEL_H_FRAC);
  const cellPx = Math.max(1, Math.floor(Math.min(w, qrAreaH) / size));
  const gridPx = cellPx * size;
  const ox = Math.floor((w - gridPx) / 2);
  const oy = Math.floor((qrAreaH - gridPx) / 2);

  ctx.fillStyle = "#0a0a0a";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) {
        ctx.fillRect(ox + col * cellPx, oy + row * cellPx, cellPx, cellPx);
      }
    }
  }

  const labelY = qrAreaH + (h * LABEL_H_FRAC) / 2;
  const labelPx = fitFont(ctx, content.label, w * 0.9, h * LABEL_H_FRAC * 0.55, "500");
  ctx.font = `500 ${labelPx}px ${FONT}`;
  ctx.fillStyle = "#52525b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(content.label, w / 2, labelY);
}

function drawSponsorLogo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  it: Extract<ZoneContent, { type: "sponsors" }>["items"][number],
  alpha: number,
): void {
  const img = getImage(it.src);
  if (!img || img.naturalWidth === 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (it.background) {
    ctx.fillStyle = it.background;
    ctx.fillRect(0, 0, w, h);
  }
  drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, w, h, it);
  ctx.restore();
}

function paintSponsors(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: Extract<ZoneContent, { type: "sponsors" }>,
  tMs: number,
): void {
  const items = content.items.filter((it) => it.src);

  if (content.mode === "rotate") {
    if (items.length === 0) return placeholder(ctx, 8, 8, w - 16, h - 16, "SPONSOR");
    const interval = Math.max(800, content.intervalMs);
    const idx = Math.floor(tMs / interval) % items.length;
    const phase = (tMs % interval) / interval;
    const FADE = 0.15;
    if (phase > 1 - FADE) {
      const t = (phase - (1 - FADE)) / FADE;
      drawSponsorLogo(ctx, w, h, items[idx], 1 - t);
      drawSponsorLogo(ctx, w, h, items[(idx + 1) % items.length], t);
    } else {
      drawSponsorLogo(ctx, w, h, items[idx], 1);
    }
    return;
  }

  // Grid: equal, evenly-spaced cells, one logo each, each with its own transform.
  const count = items.length > 0 ? items.length : Math.max(1, Math.round(h / w));
  const cols = sponsorColumns(content.columns, count, w, h);
  const cells = sponsorGrid(count, w, h, cols, content.cellPadding);

  for (let i = 0; i < count; i++) {
    const cell = cells[i];
    const it = items[i];
    if (!it) {
      placeholder(ctx, cell.x, cell.y, cell.w, cell.h, "LOGO");
      continue;
    }
    if (it.background) {
      ctx.fillStyle = it.background;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    }
    const img = getImage(it.src);
    if (img && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(cell.x, cell.y);
      drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, cell.w, cell.h, it);
      ctx.restore();
    } else {
      placeholder(ctx, cell.x, cell.y, cell.w, cell.h, "LOGO");
    }
  }
}

function paintImage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: Extract<ZoneContent, { type: "image" }>,
): void {
  if (content.background) {
    ctx.fillStyle = content.background;
    ctx.fillRect(0, 0, w, h);
  }
  const img = getImage(content.src);
  if (!img || img.naturalWidth === 0) return placeholder(ctx, 8, 8, w - 16, h - 16, "IMAGE");
  drawTransformed(ctx, img, img.naturalWidth, img.naturalHeight, w, h, content);
}

function paintVideo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: Extract<ZoneContent, { type: "video" }>,
): void {
  const v = getVideo(content.src, { loop: content.loop, muted: content.muted });
  if (!v || v.videoWidth === 0) return placeholder(ctx, 8, 8, w - 16, h - 16, "VIDEO");
  drawMedia(ctx, v, v.videoWidth, v.videoHeight, 0, 0, w, h, content.fit);
}

// ---- helpers ---------------------------------------------------------------

/**
 * Draw an image with the crop/place transform (padding inset, fit baseline, zoom
 * multiplier, and pan offset). Shared by the painter and the inspector's crop
 * editor so the editor preview matches the output exactly.
 */
export function drawTransformed(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  mw: number,
  mh: number,
  w: number,
  h: number,
  t: { fit: "contain" | "cover"; scale: number; offset: { x: number; y: number }; padding: number },
): void {
  if (!mw || !mh) return;
  const pad = Math.min(w, h) * t.padding;
  const iw = Math.max(1, w - pad * 2);
  const ih = Math.max(1, h - pad * 2);
  const baseline = t.fit === "cover" ? Math.max(iw / mw, ih / mh) : Math.min(iw / mw, ih / mh);
  const scale = baseline * Math.max(0.1, t.scale);
  const dw = mw * scale;
  const dh = mh * scale;
  const dx = pad + (iw - dw) / 2 + t.offset.x * iw;
  const dy = pad + (ih - dh) / 2 + t.offset.y * ih;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, pad, iw, ih);
  ctx.clip();
  ctx.drawImage(media, dx, dy, dw, dh);
  ctx.restore();
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  mw: number,
  mh: number,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: "contain" | "cover",
): void {
  if (!mw || !mh) return;
  const scale = fit === "cover" ? Math.max(w / mw, h / mh) : Math.min(w / mw, h / mh);
  const dw = mw * scale;
  const dh = mh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(media, dx, dy, dw, dh);
  ctx.restore();
}

function placeholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): void {
  if (w < 6 || h < 6) return;
  ctx.save();
  // Quiet, finished empty state — a hairline frame and a centered caption.
  ctx.strokeStyle = "#ececef";
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(10, w * 0.06, h * 0.06));
  ctx.stroke();
  ctx.fillStyle = "#b7bbc2";
  ctx.font = `600 ${Math.max(9, Math.min(13, h * 0.12))}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "1.5px";
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h / 2);
  ctx.letterSpacing = "0px";
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function centerText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.font = `600 ${fitFont(ctx, text, w * 0.8, 22, "600")}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
}

export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxPx: number,
  weight: string,
): number {
  let px = Math.floor(maxPx);
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 2;
  } while (px > 8);
  return px;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (maxW <= 0) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

export function hexA(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return hex.length === 7 ? hex + a : hex;
}

/** Monotonic-ish clock for animations. */
function tNow(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}
