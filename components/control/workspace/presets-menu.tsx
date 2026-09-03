"use client";

import { CaretDown, FloppyDisk, Stack, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ArcConfig } from "@/lib/arc/layout-model";
import type { Preset } from "@/lib/arc/presets";

/**
 * Switch the whole arc layout between built-in modes and the operator's saved
 * layouts, and save the current layout as a new preset.
 */
export function PresetsMenu({
  builtins,
  custom,
  onApply,
  onSave,
  onDelete,
}: {
  builtins: Preset[];
  custom: Preset[];
  onApply: (config: ArcConfig) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const apply = (config: ArcConfig) => {
    onApply(config);
    setOpen(false);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Stack weight="bold" />
            Presets
            <CaretDown weight="bold" className="text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-64">
        <Section label="Built-in">
          {builtins.map((p) => (
            <ApplyRow key={p.id} name={p.name} onApply={() => apply(p.config)} />
          ))}
        </Section>

        {custom.length > 0 && (
          <Section label="Saved layouts">
            {custom.map((p) => (
              <ApplyRow
                key={p.id}
                name={p.name}
                onApply={() => apply(p.config)}
                onDelete={() => onDelete(p.id)}
              />
            ))}
          </Section>
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
            <Button type="button" size="sm" onClick={save} disabled={!name.trim()}>
              <FloppyDisk weight="bold" />
              Save
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
  onApply,
  onDelete,
}: {
  name: string;
  onApply: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={onApply}
        className="flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
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
