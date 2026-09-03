"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { AssetInfo } from "@/lib/arc/assets-shared";
import { forgetThumbnail } from "@/lib/arc/thumbnails";

/**
 * The asset library, held in a single module-level store.
 *
 * Every content type that can carry a logo mounts its own library trigger, so a
 * per-hook `useState` meant the list was fetched once per trigger and each copy
 * drifted after an upload or a move. One store, one fetch, one truth.
 */
interface LibraryState {
  assets: AssetInfo[];
  folders: string[];
  assetFolders: Record<string, string>;
  loading: boolean;
  error: string | null;
}

let state: LibraryState = {
  assets: [],
  folders: [],
  assetFolders: {},
  loading: true,
  error: null,
};

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

async function folderAction(body: Record<string, unknown>): Promise<void> {
  await fetch("/api/assets/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function refresh(): Promise<void> {
  try {
    const [assetsRes, foldersRes] = await Promise.all([
      fetch("/api/assets", { cache: "no-store" }),
      fetch("/api/assets/folders", { cache: "no-store" }),
    ]);
    if (!assetsRes.ok) throw new Error(String(assetsRes.status));
    if (!foldersRes.ok) throw new Error(String(foldersRes.status));
    const assetsData = (await assetsRes.json()) as { assets: AssetInfo[] };
    const foldersData = (await foldersRes.json()) as {
      folders: string[];
      assetFolders: Record<string, string>;
    };
    set({
      assets: assetsData.assets,
      folders: foldersData.folders,
      assetFolders: foldersData.assetFolders,
      error: null,
      loading: false,
    });
  } catch {
    set({ error: "Couldn't load the media library.", loading: false });
  }
}

async function upload(files: FileList | File[], folder?: string | null): Promise<AssetInfo[]> {
  const saved: AssetInfo[] = [];
  let uploadError: string | null = null;

  for (const file of Array.from(files)) {
    const dataUrl = await readFileAsDataURL(file);
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        dataUrl,
        ...(folder != null ? { folder } : {}),
      }),
    });
    if (res.ok) {
      const { asset } = (await res.json()) as { asset: AssetInfo };
      saved.push(asset);
    } else {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      uploadError = `Couldn't upload ${file.name}${body?.error ? `: ${body.error}` : ""}`;
    }
  }

  if (saved.length === 0) {
    set({ error: uploadError });
    return saved;
  }

  const assetFolders = { ...state.assetFolders };
  if (folder) for (const a of saved) assetFolders[a.id] = folder;
  set({ error: uploadError, assets: [...saved, ...state.assets], assetFolders });
  return saved;
}

async function remove(id: string): Promise<void> {
  const asset = state.assets.find((a) => a.id === id);
  if (asset) forgetThumbnail(asset.url);
  const assetFolders = { ...state.assetFolders };
  delete assetFolders[id];
  set({ assets: state.assets.filter((a) => a.id !== id), assetFolders });
  await fetch(`/api/assets/${id}`, { method: "DELETE" });
}

async function createFolder(name: string): Promise<void> {
  if (!state.folders.includes(name)) set({ folders: [...state.folders, name] });
  await folderAction({ action: "create", name });
}

async function renameFolder(oldName: string, newName: string): Promise<void> {
  const assetFolders: Record<string, string> = {};
  for (const [id, f] of Object.entries(state.assetFolders)) {
    assetFolders[id] = f === oldName ? newName : f;
  }
  set({ folders: state.folders.map((f) => (f === oldName ? newName : f)), assetFolders });
  await folderAction({ action: "rename", oldName, newName });
}

async function deleteFolder(name: string): Promise<void> {
  const assetFolders = { ...state.assetFolders };
  for (const id of Object.keys(assetFolders)) {
    if (assetFolders[id] === name) delete assetFolders[id];
  }
  set({ folders: state.folders.filter((f) => f !== name), assetFolders });
  await folderAction({ action: "delete", name });
}

async function moveAsset(id: string, folder: string | null): Promise<void> {
  const assetFolders = { ...state.assetFolders };
  if (folder === null) delete assetFolders[id];
  else assetFolders[id] = folder;
  set({ assetFolders });
  await folderAction({ action: "move", id, folder });
}

export function useLogoLibrary() {
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

  // The mutators live on the module, so they're already referentially stable —
  // memoised children below them never re-render just because the list changed.
  return {
    ...snapshot,
    refresh,
    upload,
    remove,
    createFolder,
    renameFolder,
    deleteFolder,
    moveAsset,
  };
}
