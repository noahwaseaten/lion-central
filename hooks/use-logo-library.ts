"use client";

import { useCallback, useEffect, useState } from "react";

import type { AssetInfo } from "@/lib/arc/assets-shared";

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

export function useLogoLibrary() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [assetFolders, setAssetFolders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
      setAssets(assetsData.assets);
      setFolders(foldersData.folders);
      setAssetFolders(foldersData.assetFolders);
      setError(null);
    } catch {
      setError("Couldn't load the media library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files: FileList | File[], folder?: string | null): Promise<AssetInfo[]> => {
      const list = Array.from(files);
      const saved: AssetInfo[] = [];
      for (const file of list) {
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
        }
      }
      if (saved.length) {
        setAssets((prev) => [...saved, ...prev]);
        if (folder) {
          setAssetFolders((prev) => {
            const next = { ...prev };
            for (const a of saved) next[a.id] = folder;
            return next;
          });
        }
      }
      return saved;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setAssetFolders((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
  }, []);

  const createFolder = useCallback(async (name: string) => {
    setFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    await folderAction({ action: "create", name });
  }, []);

  const renameFolder = useCallback(async (oldName: string, newName: string) => {
    setFolders((prev) => prev.map((f) => (f === oldName ? newName : f)));
    setAssetFolders((prev) => {
      const next: Record<string, string> = {};
      for (const [id, f] of Object.entries(prev)) {
        next[id] = f === oldName ? newName : f;
      }
      return next;
    });
    await folderAction({ action: "rename", oldName, newName });
  }, []);

  const deleteFolder = useCallback(async (name: string) => {
    setFolders((prev) => prev.filter((f) => f !== name));
    setAssetFolders((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id] === name) delete next[id];
      }
      return next;
    });
    await folderAction({ action: "delete", name });
  }, []);

  const moveAsset = useCallback(async (id: string, folder: string | null) => {
    setAssetFolders((prev) => {
      const next = { ...prev };
      if (folder === null) delete next[id];
      else next[id] = folder;
      return next;
    });
    await folderAction({ action: "move", id, folder });
  }, []);

  return {
    assets,
    folders,
    assetFolders,
    loading,
    error,
    refresh,
    upload,
    remove,
    createFolder,
    renameFolder,
    deleteFolder,
    moveAsset,
  };
}
