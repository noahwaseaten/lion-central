import { defaultTransform, type ImageTransform, type SponsorItem } from "./content";

/** Move the item at `from` to `to`, clamped. Order drives grid placement and rotation sequence. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const target = Math.min(items.length - 1, Math.max(0, to));
  if (target === from) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

export function removeAt<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items;
  return items.filter((_, i) => i !== index);
}

/**
 * Give every logo the same framing.
 *
 * Setting padding and fit ten times over, once per sponsor, is the slowest part
 * of dressing a board; getting one right and pushing it across is the fast path.
 */
export function applyFramingToAll(items: SponsorItem[], framing: ImageTransform): SponsorItem[] {
  return items.map((item) => ({ ...item, ...framing, src: item.src }));
}

/** Whether a logo still has its untouched default framing — used to mark edited rows. */
export function isDefaultFraming(t: ImageTransform): boolean {
  const d = defaultTransform();
  return (
    t.fit === d.fit &&
    t.scale === d.scale &&
    t.offset.x === d.offset.x &&
    t.offset.y === d.offset.y &&
    t.padding === d.padding &&
    t.background === d.background &&
    t.shadow.enabled === d.shadow.enabled
  );
}

/** Just the framing of an item, without its `src`. */
export function framingOf(item: SponsorItem): ImageTransform {
  const { fit, scale, offset, padding, background, shadow } = item;
  return { fit, scale, offset, padding, background, shadow };
}
