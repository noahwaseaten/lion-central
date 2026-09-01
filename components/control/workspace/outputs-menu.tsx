"use client";

import { ArrowSquareOut, CaretDown, Monitor } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { SURFACES } from "@/lib/arc/surfaces";

/** Opens each surface's clean `/output/<surface>` render in a new tab. */
export function OutputsMenu() {
  const open = (path: string) => window.open(path, "_blank", "noopener,noreferrer");

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Monitor weight="bold" />
            Outputs
            <CaretDown weight="bold" className="text-muted-foreground" />
          </Button>
        }
      />
      <MenuContent>
        <MenuItem onClick={() => open("/output/all")}>
          <Monitor />
          All surfaces (combined)
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>Open a single surface</MenuLabel>
        {SURFACES.map((s) => (
          <MenuItem key={s.id} onClick={() => open(`/output/${s.id}`)}>
            <ArrowSquareOut />
            {s.label}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onClick={() => SURFACES.forEach((s) => open(`/output/${s.id}`))}>
          <ArrowSquareOut />
          Open all separately
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
