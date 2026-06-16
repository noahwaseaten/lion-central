import {
  type Icon,
  PersonSimpleBike,
  PersonSimpleRun,
  PersonSimpleSwim,
} from "@phosphor-icons/react";

import { splitLabel } from "@/lib/feed/format";
import type { Split } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

/** Single source of truth for split → visual treatment. */
export const SPLIT_META: Record<
  Split,
  { label: string; Glyph: Icon; text: string; tint: string; accent: string }
> = {
  swim: {
    label: "Swim",
    Glyph: PersonSimpleSwim,
    text: "text-swim",
    tint: "bg-swim/10",
    accent: "shadow-[inset_3px_0_0_var(--swim)]",
  },
  bike: {
    label: "Bike",
    Glyph: PersonSimpleBike,
    text: "text-bike",
    tint: "bg-bike/10",
    accent: "shadow-[inset_3px_0_0_var(--bike)]",
  },
  run: {
    label: "Run",
    Glyph: PersonSimpleRun,
    text: "text-run",
    tint: "bg-run/10",
    accent: "shadow-[inset_3px_0_0_var(--run)]",
  },
};

/** Small colored chip: split icon + label. */
export function SplitBadge({
  split,
  className,
}: {
  split: Split;
  className?: string;
}) {
  const meta = SPLIT_META[split];
  const Glyph = meta.Glyph;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em]",
        meta.text,
        className,
      )}
    >
      <Glyph weight="bold" className="size-[1.05em]" aria-hidden />
      {splitLabel(split)}
    </span>
  );
}
