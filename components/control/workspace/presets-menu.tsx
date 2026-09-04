"use client";

import { CaretDown, Check, FloppyDisk, Stack, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Preset } from "@/lib/arc/presets";

/**
 * Switch the current layout to a saved preset, save the current layout as a
 * new preset, or — if a preset is currently applied — update it in place
 * with whatever's been edited since.
 */
export function PresetsMenu({
  custom,
  activePresetId,
  onApply,
  onSave,
  onUpdate,
  onDelete,
}: {
  custom: Preset[];
  activePresetId: string | null;
  onApply: (preset: Preset) => void;
  onSave: (name: string) => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpenRaw] = useState(false);
  const [name, setName] = useState("");

  const active = custom.find((p) => p.id === activePresetId) ?? null;

  // Default the save field to the active preset's name on open, so re-saving
  // without typing anything updates it rather than silently creating a duplicate.
  const setOpen = (next: boolean) => {
    if (next) setName(active?.name ?? "");
    setOpenRaw(next);
  };

  const apply = (preset: Preset) => {
    onApply(preset);
    setOpen(false);
  };

  const update = () => {
    if (!active) return;
    onUpdate(active.id);
    setOpen(false);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setOpen(false);
  };

  const savingOverActive = active !== null && name.trim().toLowerCase() === active.name.toLowerCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Stack weight="bold" />
            {active ? active.name : "Presets"}
            <CaretDown weight="bold" className="text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-64">
        {custom.length > 0 && (
          <Section label="Saved layouts">
            {custom.map((p) => (
              <ApplyRow
                key={p.id}
                name={p.name}
                active={p.id === activePresetId}
                onApply={() => apply(p)}
                onDelete={() => onDelete(p.id)}
              />
            ))}
          </Section>
        )}

        {active && (
          <div className={custom.length > 0 ? "mt-3 border-t border-border pt-3" : ""}>
            <Button type="button" size="sm" className="w-full" onClick={update}>
              <FloppyDisk weight="bold" />
              Update &ldquo;{active.name}&rdquo;
            </Button>
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            Save current layout
          </span>
          <div className="mt-1.5 flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Layout name"
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="button" size="sm" variant="outline" onClick={save} disabled={!name.trim()}>
              <FloppyDisk weight="bold" />
              {savingOverActive ? "Update" : "Save as new"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-col gap-0.5 last:mb-0">
      <span className="px-1 pb-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function ApplyRow({
  name,
  active,
  onApply,
  onDelete,
}: {
  name: string;
  active: boolean;
  onApply: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={onApply}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Check weight="bold" className={active ? "size-3.5 shrink-0 text-foreground" : "size-3.5 shrink-0 opacity-0"} />
        <span className="truncate">{name}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
          className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [&_svg]:size-3.5"
        >
          <Trash />
        </button>
      )}
    </div>
  );
}
