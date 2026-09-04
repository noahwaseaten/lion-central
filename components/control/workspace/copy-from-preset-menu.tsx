"use client";

import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import type { ArcComponent } from "@/lib/arc/layout-model";
import type { Preset } from "@/lib/arc/presets";
import { SURFACES, type SurfaceId } from "@/lib/arc/surfaces";

import { CONTENT_META } from "./content-meta";

interface SourceComponent {
  preset: Preset;
  surface: SurfaceId;
  component: ArcComponent;
}

/**
 * A menu of every component across every saved layout, so an operator can
 * pull one onto the current surface without applying (and thereby losing
 * unsaved edits to) the layout it lives in.
 */
export function CopyFromPresetMenu({
  trigger,
  presets,
  onCopy,
}: {
  trigger: React.ReactElement;
  presets: Preset[];
  onCopy: (source: SourceComponent) => void;
}) {
  const byPreset: { preset: Preset; rows: SourceComponent[] }[] = presets.map((preset) => ({
    preset,
    rows: SURFACES.flatMap((surface) =>
      (preset.config.surfaces[surface.id] ?? []).map((component) => ({ preset, surface: surface.id, component })),
    ),
  }));
  const hasAny = byPreset.some((g) => g.rows.length > 0);

  return (
    <Menu>
      <MenuTrigger render={trigger} />
      <MenuContent align="end" className="max-h-80 overflow-y-auto">
        <MenuLabel>Copy from a saved layout</MenuLabel>
        {!hasAny && (
          <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
            {presets.length === 0 ? "No saved layouts yet." : "Your saved layouts don't have any components yet."}
          </p>
        )}
        {byPreset.map(({ preset, rows }) =>
          rows.length === 0
            ? null
            : rows.map((row) => {
                const meta = CONTENT_META[row.component.content.type];
                const surface = SURFACES.find((s) => s.id === row.surface);
                return (
                  <MenuItem
                    key={`${preset.id}:${row.component.id}`}
                    onClick={() => onCopy(row)}
                  >
                    <meta.Icon />
                    <span className="min-w-0 flex-1 truncate">
                      {row.component.name ?? meta.label}
                    </span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {preset.name} · {surface?.label}
                    </span>
                  </MenuItem>
                );
              }),
        )}
      </MenuContent>
    </Menu>
  );
}
