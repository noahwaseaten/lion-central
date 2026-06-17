"use client";

import { Plus } from "@phosphor-icons/react";

import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { CONTENT_TYPES, type ContentType } from "@/lib/arc/content";

import { CONTENT_META } from "./content-meta";

/**
 * A menu of component types to install onto a surface. `trigger` lets callers
 * style the opener (a stage chip, a rail button, …); `onAdd` fires with the chosen
 * type.
 */
export function AddComponentMenu({
  trigger,
  side = "bottom",
  align = "start",
  onAdd,
}: {
  trigger: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onAdd: (type: ContentType) => void;
}) {
  return (
    <Menu>
      <MenuTrigger render={trigger} />
      <MenuContent side={side} align={align}>
        <MenuLabel>Add component</MenuLabel>
        {CONTENT_TYPES.map(({ type, label }) => {
          const meta = CONTENT_META[type];
          return (
            <MenuItem key={type} onClick={() => onAdd(type)}>
              <meta.Icon />
              {label}
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}

export { Plus as AddIcon };
