"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Local test helper: append one random athlete line to the selected feed file so
 * the feed animation can be previewed without the timing backend. Disabled with a
 * reason when no file is chosen.
 */
export function TestFeedButton({ file }: { file: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const append = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/feed/append?file=${encodeURIComponent(file)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Append failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Append failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => void append()}
      disabled={busy || !file}
      title={file ? "Append a random athlete line" : "Select a feed file first"}
      aria-label="Append a random athlete line to the feed"
    >
      <Plus weight="bold" />
      {error ?? (busy ? "Writing…" : "Test line")}
    </Button>
  );
}
