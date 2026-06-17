"use client";

import { useCallback, useEffect, useState } from "react";

import type { ZoneContent } from "@/lib/arc/content";
import {
  type ArcComponent,
  type ArcConfig,
  DEFAULT_ARC_CONFIG,
  makeComponent,
  migrate,
  type NormRect,
} from "@/lib/arc/layout-model";
import type { SurfaceId } from "@/lib/arc/surfaces";

const KEY = "lion-central.arc";

/** Where a freshly-added component lands before the operator moves it. */
const NEW_RECT: NormRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

export type ReorderDir = "front" | "back" | "forward" | "backward";

/**
 * The arc's layout configuration — every surface's ordered list of components.
 * Persisted to localStorage and synced across tabs (storage events) so an operator
 * change on the control page updates every `/output/*` tab live.
 */
export function useArcConfig() {
  const [config, setConfig] = useState<ArcConfig>(DEFAULT_ARC_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate persisted config once on mount */
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setConfig(migrate(JSON.parse(raw)));
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(config));
    } catch {
      // ignore quota / privacy mode
    }
  }, [config, loaded]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        setConfig(migrate(JSON.parse(e.newValue)));
      } catch {
        // ignore malformed broadcast
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setBackground = useCallback(
    (background: string) => setConfig((c) => ({ ...c, background })),
    [],
  );

  const replaceConfig = useCallback((next: ArcConfig) => setConfig(next), []);

  /** Update one surface's component list immutably. */
  const editSurface = useCallback(
    (surface: SurfaceId, fn: (list: ArcComponent[]) => ArcComponent[]) =>
      setConfig((c) => ({
        ...c,
        surfaces: { ...c.surfaces, [surface]: fn(c.surfaces[surface] ?? []) },
      })),
    [],
  );

  const editComponent = useCallback(
    (surface: SurfaceId, id: string, fn: (comp: ArcComponent) => ArcComponent) =>
      editSurface(surface, (list) => list.map((comp) => (comp.id === id ? fn(comp) : comp))),
    [editSurface],
  );

  const addComponent = useCallback(
    (surface: SurfaceId, content: ZoneContent, rect: NormRect = NEW_RECT): string => {
      const comp = makeComponent(content, rect);
      editSurface(surface, (list) => [...list, comp]);
      return comp.id;
    },
    [editSurface],
  );

  const removeComponent = useCallback(
    (surface: SurfaceId, id: string) =>
      editSurface(surface, (list) => list.filter((c) => c.id !== id)),
    [editSurface],
  );

  const setComponentContent = useCallback(
    (surface: SurfaceId, id: string, content: ZoneContent) =>
      editComponent(surface, id, (c) => ({ ...c, content })),
    [editComponent],
  );

  const setComponentRect = useCallback(
    (surface: SurfaceId, id: string, rect: NormRect) =>
      editComponent(surface, id, (c) => ({ ...c, rect })),
    [editComponent],
  );

  const renameComponent = useCallback(
    (surface: SurfaceId, id: string, name: string) =>
      editComponent(surface, id, (c) => ({ ...c, name: name.trim() || undefined })),
    [editComponent],
  );

  const reorderComponent = useCallback(
    (surface: SurfaceId, id: string, dir: ReorderDir) =>
      editSurface(surface, (list) => {
        const i = list.findIndex((c) => c.id === id);
        if (i < 0) return list;
        const next = [...list];
        const [item] = next.splice(i, 1);
        const to =
          dir === "front"
            ? next.length
            : dir === "back"
              ? 0
              : dir === "forward"
                ? Math.min(next.length, i + 1)
                : Math.max(0, i - 1);
        next.splice(to, 0, item);
        return next;
      }),
    [editSurface],
  );

  return {
    config,
    loaded,
    setBackground,
    replaceConfig,
    addComponent,
    removeComponent,
    setComponentContent,
    setComponentRect,
    renameComponent,
    reorderComponent,
  };
}

export type ArcConfigApi = ReturnType<typeof useArcConfig>;
