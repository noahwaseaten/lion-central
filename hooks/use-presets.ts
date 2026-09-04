"use client";

import { useCallback, useEffect, useState } from "react";

import { type ArcConfig, migrate, newId } from "@/lib/arc/layout-model";
import type { Preset } from "@/lib/arc/presets";

const KEY = "lion-central.presets";

function load(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is { id?: unknown; name?: unknown; config?: unknown } => !!p && typeof p === "object")
      .map((p) => ({
        id: typeof p.id === "string" ? p.id : newId(),
        name: typeof p.name === "string" ? p.name : "Untitled",
        config: migrate(p.config),
      }));
  } catch {
    return [];
  }
}

const clone = (c: ArcConfig): ArcConfig => JSON.parse(JSON.stringify(c)) as ArcConfig;

/** "Race Day" → "Race Day copy", or "Race Day copy 2", "copy 3", … if those are already taken. */
function copyName(base: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  let candidate = `${base} copy`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} copy ${n}`;
    n += 1;
  }
  return candidate;
}

/**
 * Saved layouts (full-layout snapshots), persisted to localStorage. Save as
 * new (replacing one of the same name) or update an existing preset in place
 * by id — the workspace uses `update` to sync the preset it currently has
 * applied without needing to retype its name.
 */
export function usePresets() {
  const [custom, setCustom] = useState<Preset[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted presets once
    setCustom(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(custom));
    } catch {
      // ignore quota / privacy mode
    }
  }, [custom, loaded]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setCustom(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Save as a new preset (or replace one of the same name); returns its id. */
  const save = useCallback((name: string, config: ArcConfig): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = newId();
    setCustom((list) => {
      const without = list.filter((p) => p.name.toLowerCase() !== trimmed.toLowerCase());
      return [...without, { id, name: trimmed, config: clone(config) }];
    });
    return id;
  }, []);

  /** Update an existing preset's layout in place, keeping its id and name. */
  const update = useCallback((id: string, config: ArcConfig) => {
    setCustom((list) => list.map((p) => (p.id === id ? { ...p, config: clone(config) } : p)));
  }, []);

  /** Copy a preset under a new name ("<name> copy"); returns the new preset's id. */
  const duplicate = useCallback(
    (id: string): string | null => {
      const source = custom.find((p) => p.id === id);
      if (!source) return null;
      const newPresetId = newId();
      const name = copyName(source.name, custom.map((p) => p.name));
      setCustom((list) => [...list, { id: newPresetId, name, config: clone(source.config) }]);
      return newPresetId;
    },
    [custom],
  );

  const remove = useCallback((id: string) => {
    setCustom((list) => list.filter((p) => p.id !== id));
  }, []);

  return { custom, save, update, duplicate, remove };
}
