import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder sponsor zone. Arc Control will later inject real logos; for now
 * this renders a neutral, clearly-labeled slot sized to its region.
 */
export function SponsorSlot({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      data-slot="sponsor"
      className={cn(
        "flex items-center justify-center border border-dashed border-neutral-200 bg-white text-neutral-300",
        className,
      )}
    >
      <span className="text-xs font-medium uppercase tracking-[0.2em]">{name}</span>
    </div>
  );
}
