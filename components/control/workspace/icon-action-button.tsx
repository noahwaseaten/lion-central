"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The single icon-only action button used everywhere in the workspace sidebars
 * (layer reorder/duplicate/delete, position align, layer order). Wraps the
 * shared `Button` primitive so every icon action gets the same focus ring,
 * hover, and press feedback — instead of each panel re-implementing its own.
 */
export function IconActionButton({
  label,
  disabled,
  active,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  /** Toggled/current-state look (e.g. an active alignment) — uses the accent token, not a border. */
  active?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        active && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {children}
    </Button>
  );
}
