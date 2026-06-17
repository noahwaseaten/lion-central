"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";

const Menu = MenuPrimitive.Root;
const MenuTrigger = MenuPrimitive.Trigger;
const MenuGroup = MenuPrimitive.Group;
const MenuRadioGroup = MenuPrimitive.RadioGroup;

/** Styled dropdown surface. Wrap items in <MenuContent>{…<MenuItem/>…}</MenuContent>. */
function MenuContent({
  children,
  className,
  side = "bottom",
  align = "start",
  sideOffset = 6,
}: {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50">
        <MenuPrimitive.Popup
          className={cn(
            "min-w-44 origin-[var(--transform-origin)] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl shadow-black/40 outline-none",
            "transition-[transform,opacity] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            "motion-reduce:transition-none",
            className,
          )}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function MenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A standalone section heading. Rendered as a plain element (not Base UI's
 * `GroupLabel`, which requires a `<Menu.Group>` ancestor) so it can be used
 * directly inside a menu without wrapping every section in a group.
 */
function MenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="presentation"
      className={cn(
        "px-2.5 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function MenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2.5 pl-2.5 text-sm outline-none select-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function MenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuGroup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuLabel,
  MenuSeparator,
};
