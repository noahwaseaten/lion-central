"use client";

import { ArrowSquareOut, Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { SURFACES } from "@/lib/arc/surfaces";

/** Local test helpers: append a random athlete line; open output windows. */
export function TestToolsSection({ file }: { file: string | null }) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const append = async () => {
    if (!file) {
      setError("Select a feed file first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/feed/append?file=${encodeURIComponent(file)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Append failed");
      setLast(data.line as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Append failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={() => void append()} disabled={busy}>
        <Plus weight="bold" />
        {busy ? "Writing…" : "Append random athlete"}
      </Button>
      {last && (
        <p className="text-xs text-muted-foreground">
          Wrote: <span className="font-mono text-foreground">{last}</span>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Open output window</span>
        <div className="grid grid-cols-2 gap-2">
          {SURFACES.map((s) => (
            <a
              key={s.id}
              href={`/output/${s.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowSquareOut weight="bold" />
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
