"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { FontAssetInfo } from "@/lib/arc/fonts-shared";

/**
 * The custom-font library, held in a single module-level store — same shape
 * as `use-logo-library.ts` so every text component's font picker shares one
 * fetch and stays in sync after an upload.
 */
interface LibraryState {
  fonts: FontAssetInfo[];
  loading: boolean;
  error: string | null;
}

let state: LibraryState = { fonts: [], loading: true, error: null };
const SERVER_STATE: LibraryState = state;

const listeners = new Set<() => void>();
let started = false;

function set(patch: Partial<LibraryState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function refresh(): Promise<void> {
  try {
    const res = await fetch("/api/fonts", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { fonts: FontAssetInfo[] };
    set({ fonts: data.fonts, error: null, loading: false });
  } catch {
    set({ error: "Couldn't load the font library.", loading: false });
  }
}

/** Guess a readable family name from a filename, e.g. "RistrettoSlabPro-Regular.otf" → "Ristretto Slab Pro Regular". */
function familyFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return base
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

async function upload(file: File, family?: string): Promise<FontAssetInfo | null> {
  const dataUrl = await readFileAsDataURL(file);
  const res = await fetch("/api/fonts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      family: family?.trim() || familyFromFilename(file.name) || file.name,
      dataUrl,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    set({ error: `Couldn't upload ${file.name}${body?.error ? `: ${body.error}` : ""}` });
    return null;
  }
  const { font } = (await res.json()) as { font: FontAssetInfo };
  set({ error: null, fonts: [font, ...state.fonts] });
  return font;
}

async function remove(id: string): Promise<void> {
  set({ fonts: state.fonts.filter((f) => f.id !== id) });
  await fetch(`/api/fonts/${id}`, { method: "DELETE" });
}

export function useFontLibrary() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );

  useEffect(() => {
    if (started) return;
    started = true;
    void refresh();
  }, []);

  return { ...snapshot, refresh, upload, remove };
}
