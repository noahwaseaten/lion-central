"use client";

import { useCallback, useEffect, useState } from "react";

import { type ArcConfig, migrate, newId } from "@/lib/arc/layout-model";
import { BUILTIN_PRESETS, type Preset } from "@/lib/arc/presets";

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

/**
 * Custom saved layouts, persisted to localStorage and merged after the built-ins.
 * Built-ins are read-only; custom presets can be saved (replacing one of the same
 * name) and deleted.
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

  const save = useCallback((name: string, config: ArcConfig) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustom((list) => {
      const without = list.filter((p) => p.name.toLowerCase() !== trimmed.toLowerCase());
      return [...without, { id: newId(), name: trimmed, config: clone(config) }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCustom((list) => list.filter((p) => p.id !== id));
  }, []);

  return { builtins: BUILTIN_PRESETS, custom, presets: [...BUILTIN_PRESETS, ...custom], save, remove };
}
