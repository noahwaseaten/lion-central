"use client";

import { Check, Trash, UploadSimple } from "@phosphor-icons/react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { useLogoLibrary } from "@/hooks/use-logo-library";
import { cn } from "@/lib/utils";

/**
 * The shared logo library: a gallery of server-stored logos to pick from, plus
 * upload and delete. Picking calls `onPick` with the logo's stable URL. `selected`
 * highlights logos already used by the current component.
 */
export function LogoLibrary({
  onPick,
  selected = [],
}: {
  onPick: (url: string) => void;
  selected?: string[];
}) {
  const { assets, loading, error, upload, remove } = useLogoLibrary();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Logo library</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <UploadSimple weight="bold" />
          Upload
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <p className="text-xs text-muted-foreground/70">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground/70">
          No logos yet.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          {assets.map((a) => {
            const active = selected.includes(a.url);
            return (
              <li key={a.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onPick(a.url)}
                  title={a.name}
                  className={cn(
                    "grid aspect-square w-full place-items-center overflow-hidden rounded-md border bg-[#1c1f26] p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-signal ring-1 ring-signal" : "border-input hover:border-foreground/40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded logo, not a build asset */}
                  <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" />
                </button>
                {active && (
                  <span className="pointer-events-none absolute left-1 top-1 grid size-4 place-items-center rounded-full bg-signal text-background">
                    <Check weight="bold" className="size-2.5" />
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${a.name}`}
                  onClick={() => void remove(a.id)}
                  className="absolute right-1 top-1 grid size-5 place-items-center rounded bg-background/90 text-muted-foreground opacity-0 outline-none transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [&_svg]:size-3"
                >
                  <Trash />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
