"use client";

import { useCallback, useEffect, useState } from "react";

import { type ArcConfig, newId } from "@/lib/arc/layout-model";
import type { Preset } from "@/lib/arc/presets";

async function load(): Promise<Preset[]> {
  try {
    const res = await fetch("/api/presets", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { presets?: Preset[] };
    return Array.isArray(data.presets) ? data.presets : [];
  } catch {
    return [];
  }
}

const LEGACY_KEY = "lion-central.presets";
const MIGRATED_KEY = "lion-central.presets.migrated";

/**
 * One-time pickup of presets saved under the old localStorage-only scheme, so
 * upgrading this app doesn't strand an operator's existing saved layouts in
 * their browser. Runs once per browser (tracked by `MIGRATED_KEY`) — after
 * that, an empty server list means the operator deleted everything, not that
 * migration is still pending.
 */
function takeLegacyPresets(): Preset[] | null {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return null;
    localStorage.setItem(MIGRATED_KEY, "1");
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed
      .filter((p): p is { id?: unknown; name?: unknown; config?: unknown } => !!p && typeof p === "object")
      .map((p) => ({
        id: typeof p.id === "string" ? p.id : newId(),
        name: typeof p.name === "string" ? p.name : "Untitled",
        config: p.config as ArcConfig,
      }));
  } catch {
    return null;
  }
}

function persist(presets: Preset[]): void {
  fetch("/api/presets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presets }),
  }).catch(() => {
    // best-effort — the operator's local state is already updated
  });
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
 * Saved layouts (full-layout snapshots), persisted server-side to a JSON file
 * on disk (see `lib/arc/presets-store.ts`) rather than localStorage, so they
 * travel with the repo instead of being stuck in one operator's browser. Save
 * as new (replacing one of the same name) or update an existing preset in
 * place by id — the workspace uses `update` to sync the preset it currently
 * has applied without needing to retype its name.
 */
export function usePresets() {
  const [custom, setCustom] = useState<Preset[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void load().then((presets) => {
      if (cancelled) return;
      // Only fall back to the legacy list when the server has nothing yet —
      // always calling takeLegacyPresets() marks migration done either way,
      // so a later "delete everything" doesn't get mistaken for pending migration.
      const legacy = takeLegacyPresets();
      setCustom(presets.length > 0 ? presets : (legacy ?? presets));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persist(custom);
  }, [custom, loaded]);

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
