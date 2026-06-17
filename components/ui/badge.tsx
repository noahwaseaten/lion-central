import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        outline: "border-border text-muted-foreground",
        solid: "border-transparent bg-secondary text-secondary-foreground",
        live: "border-live/30 bg-live/10 text-live",
        online: "border-online/30 bg-online/10 text-online",
        signal: "border-signal/30 bg-signal/10 text-signal",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

/** Small status/label pill. Use `variant` to encode meaning (live/online/signal). */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
