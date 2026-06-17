"use client";

import { useCallback, useEffect, useState } from "react";

import type { AssetInfo } from "@/lib/arc/assets-store";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * The shared, server-persisted logo library. Lists, uploads, and deletes assets
 * through `/api/assets`, so every component and device picks from the same set.
 */
export function useLogoLibrary() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/assets", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { assets: AssetInfo[] };
      setAssets(data.assets);
      setError(null);
    } catch {
      setError("Couldn't load the logo library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of the server-side library
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files: FileList | File[]): Promise<AssetInfo[]> => {
      const list = Array.from(files);
      const saved: AssetInfo[] = [];
      for (const file of list) {
        const dataUrl = await readFileAsDataURL(file);
        const res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, dataUrl }),
        });
        if (res.ok) {
          const { asset } = (await res.json()) as { asset: AssetInfo };
          saved.push(asset);
        }
      }
      if (saved.length) setAssets((prev) => [...saved, ...prev]);
      return saved;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
  }, []);

  return { assets, loading, error, refresh, upload, remove };
}
