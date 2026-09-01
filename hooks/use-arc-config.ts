"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ZoneContent } from "@/lib/arc/content";
import {
  type ArcComponent,
  type ArcConfig,
  type BackgroundConfig,
  clampSurfaceSize,
  DEFAULT_ARC_CONFIG,
  makeComponent,
  migrate,
  type NormRect,
} from "@/lib/arc/layout-model";
import type { SurfaceId } from "@/lib/arc/surfaces";

const LIVE_KEY = "lion-central.arc";
const DRAFT_KEY = "lion-central.arc.draft";

/** Where a freshly-added component lands before the operator moves it. */
const NEW_RECT: NormRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

const HISTORY_LIMIT = 50;
/** Edits within this window of each other collapse into a single undo step (e.g. one drag, one typing burst). */
const COALESCE_MS = 500;

export type ReorderDir = "front" | "back" | "forward" | "backward";

/**
 * The arc's layout configuration — every surface's ordered list of components.
 *
 * mode "live" (default): reads/writes `lion-central.arc`, synced across tabs via
 * storage events. Used by output routes.
 *
 * mode "draft": edits are written to `lion-central.arc.draft` only. Call
 * `publish()` to push the draft to the live key so output tabs pick it up.
 * Falls back to the live key on first load if no draft exists yet.
 */
export function useArcConfig(mode: "live" | "draft" = "live") {
  const key = mode === "draft" ? DRAFT_KEY : LIVE_KEY;
  const [config, setConfig] = useState<ArcConfig>(DEFAULT_ARC_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Suppress the dirty flag for the very first write (the initial load flush).
  const skipDirtyRef = useRef(true);

  // Undo/redo history. Stacks live in refs — mutated only from event handlers/timers,
  // never inside a setState updater (which React may invoke twice in dev/StrictMode).
  // `configRef` mirrors the latest config so those callbacks always read a fresh value
  // without needing to be recreated on every config change.
  const pastRef = useRef<ArcConfig[]>([]);
  const futureRef = useRef<ArcConfig[]>([]);
  const pendingBaselineRef = useRef<ArcConfig | null>(null);
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  // canUndo/canRedo need to trigger a render, so mirror the ref-derived counts into state
  // (refs themselves can't be read during render).
  const [historyState, setHistoryState] = useState({ pastLen: 0, futureLen: 0, hasPending: false });
  const syncHistoryState = () =>
    setHistoryState({
      pastLen: pastRef.current.length,
      futureLen: futureRef.current.length,
      hasPending: pendingBaselineRef.current !== null,
    });

  /** Commit a still-open coalesced burst (e.g. an in-progress drag) as its own undo step. */
  const flushPending = useCallback(() => {
    if (coalesceTimerRef.current) {
      clearTimeout(coalesceTimerRef.current);
      coalesceTimerRef.current = null;
    }
    if (pendingBaselineRef.current) {
      pastRef.current.push(pendingBaselineRef.current);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      pendingBaselineRef.current = null;
      syncHistoryState();
    }
  }, []);

  /**
   * Apply a config update, recording history. `coalesce: true` groups rapid
   * repeated calls (drag moves, keystrokes) into one undo step; `false` commits
   * immediately as its own step (add/remove/reorder/preset apply).
   */
  const mutate = useCallback(
    (updater: (c: ArcConfig) => ArcConfig, coalesce: boolean) => {
      const prev = configRef.current;
      futureRef.current = [];
      if (coalesce) {
        if (!pendingBaselineRef.current) pendingBaselineRef.current = prev;
        if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
        coalesceTimerRef.current = setTimeout(flushPending, COALESCE_MS);
      } else {
        flushPending();
        pastRef.current.push(prev);
        if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      }
      syncHistoryState();
      setConfig(updater(prev));
    },
    [flushPending],
  );

  const undo = useCallback(() => {
    flushPending();
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(configRef.current);
    syncHistoryState();
    setConfig(prev);
  }, [flushPending]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(configRef.current);
    syncHistoryState();
    setConfig(next);
  }, []);

  const canUndo = historyState.pastLen > 0 || historyState.hasPending;
  const canRedo = historyState.futureLen > 0;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate persisted config once on mount */
    try {
      const raw =
        localStorage.getItem(key) ??
        (mode === "draft" ? localStorage.getItem(LIVE_KEY) : null);
      if (raw) setConfig(migrate(JSON.parse(raw)));
      // If a draft already exists and differs from live, start dirty.
      if (mode === "draft") {
        const draftRaw = localStorage.getItem(DRAFT_KEY);
        const liveRaw = localStorage.getItem(LIVE_KEY);
        if (draftRaw && liveRaw && draftRaw !== liveRaw) setIsDirty(true);
      }
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(config));
    } catch {
      // ignore quota / privacy mode
    }
    if (mode === "draft") {
      if (skipDirtyRef.current) {
        skipDirtyRef.current = false;
      } else {
        setIsDirty(true);
      }
    }
  }, [config, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try {
        setConfig(migrate(JSON.parse(e.newValue)));
      } catch {
        // ignore malformed broadcast
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Push the current draft to the live key so output tabs update. */
  const publish = useCallback(() => {
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify(config));
      setIsDirty(false);
    } catch {
      // ignore quota / privacy mode
    }
  }, [config]);

  const setBackground = useCallback(
    (background: BackgroundConfig) => mutate((c) => ({ ...c, background }), true),
    [mutate],
  );

  const replaceConfig = useCallback((next: ArcConfig) => mutate(() => next, false), [mutate]);

  /** Resize a physical surface (px) — every renderer (stage, canvases, outputs) follows. */
  const setSurfaceSize = useCallback(
    (surface: SurfaceId, w: number, h: number) =>
      mutate(
        (c) => ({
          ...c,
          surfaceSizes: { ...c.surfaceSizes, [surface]: clampSurfaceSize(w, h) },
        }),
        true,
      ),
    [mutate],
  );

  /** Update one surface's component list immutably. */
  const editSurface = useCallback(
    (surface: SurfaceId, fn: (list: ArcComponent[]) => ArcComponent[], coalesce: boolean) =>
      mutate(
        (c) => ({
          ...c,
          surfaces: { ...c.surfaces, [surface]: fn(c.surfaces[surface] ?? []) },
        }),
        coalesce,
      ),
    [mutate],
  );

  const editComponent = useCallback(
    (surface: SurfaceId, id: string, fn: (comp: ArcComponent) => ArcComponent, coalesce: boolean) =>
      editSurface(surface, (list) => list.map((comp) => (comp.id === id ? fn(comp) : comp)), coalesce),
    [editSurface],
  );

  const addComponent = useCallback(
    (surface: SurfaceId, content: ZoneContent, rect: NormRect = NEW_RECT): string => {
      const comp = makeComponent(content, rect);
      editSurface(surface, (list) => [...list, comp], false);
      return comp.id;
    },
    [editSurface],
  );

  const removeComponent = useCallback(
    (surface: SurfaceId, id: string) =>
      editSurface(surface, (list) => list.filter((c) => c.id !== id), false),
    [editSurface],
  );

  const setComponentContent = useCallback(
    (surface: SurfaceId, id: string, content: ZoneContent) =>
      editComponent(surface, id, (c) => ({ ...c, content }), true),
    [editComponent],
  );

  const setComponentRect = useCallback(
    (surface: SurfaceId, id: string, rect: NormRect) =>
      editComponent(surface, id, (c) => ({ ...c, rect }), true),
    [editComponent],
  );

  const renameComponent = useCallback(
    (surface: SurfaceId, id: string, name: string) =>
      editComponent(surface, id, (c) => ({ ...c, name: name.trim() || undefined }), true),
    [editComponent],
  );

  /** Set a surface's full paint order from a list of component ids (drag-to-reorder). */
  const setSurfaceOrder = useCallback(
    (surface: SurfaceId, orderedIds: string[]) =>
      editSurface(
        surface,
        (list) => {
          const byId = new Map(list.map((c) => [c.id, c]));
          const reordered = orderedIds.map((id) => byId.get(id)).filter((c): c is ArcComponent => !!c);
          const missing = list.filter((c) => !orderedIds.includes(c.id));
          return [...reordered, ...missing];
        },
        false,
      ),
    [editSurface],
  );

  const reorderComponent = useCallback(
    (surface: SurfaceId, id: string, dir: ReorderDir) =>
      editSurface(
        surface,
        (list) => {
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
        },
        false,
      ),
    [editSurface],
  );

  return {
    config,
    loaded,
    isDirty,
    publish,
    setBackground,
    setSurfaceSize,
    replaceConfig,
    addComponent,
    removeComponent,
    setComponentContent,
    setComponentRect,
    renameComponent,
    reorderComponent,
    setSurfaceOrder,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

export type ArcConfigApi = ReturnType<typeof useArcConfig>;
