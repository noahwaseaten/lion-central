# UI Cleanup & Media Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove broken canvas affordance and noisy status text, add per-surface output tab titles with emoji favicons, and replace the flat inline logo grid with a folder-based media library modal.

**Architecture:** Folder metadata is stored in a `_folders.json` sidecar in `ASSETS_DIR` (backward-compatible — no existing URLs change). The hook fetches assets and folder data in parallel and owns the join in memory. The new `MediaLibrary` component family lives in `components/control/media-library/` and is accessed via `MediaLibraryTrigger` which opens a full modal.

**Tech Stack:** Next.js App Router, TypeScript strict, @base-ui/react (Dialog), @phosphor-icons/react, Tailwind, vitest (node env)

---

## Task 1: Remove Stage Add Chip

**Files:**
- Modify: `components/control/workspace/arc-stage.tsx`

- [ ] **Step 1: Remove the AddComponentMenu block from the stage**

In `arc-stage.tsx`, find the block inside `{SURFACES.map((surface) => { ... })}` that renders the "Add" chip (lines ~322–339). Delete the entire `{selected?.surface === surface.id && ( <AddComponentMenu ... /> )}` block. Keep the alignment guides block that follows it.

The resulting inner surface loop body should be:
```tsx
{SURFACES.map((surface) => {
  const p = getPlacement(surface.id);
  if (!p) return null;
  const list = config.surfaces[surface.id] ?? [];
  return (
    <div key={surface.id}>
      {list.map((comp) => (
        <ComponentFrame
          key={comp.id}
          comp={comp}
          placement={p}
          scale={view.scale}
          selected={selected?.surface === surface.id && selected.id === comp.id}
          siblings={list.filter((c) => c.id !== comp.id).map((c) => c.rect)}
          onSelect={() => onSelect({ surface: surface.id, id: comp.id })}
          onChange={(rect) => setComponentRect(surface.id, comp.id, rect)}
          onGuides={(lines) =>
            setGuides(lines.length ? { surface: surface.id, lines } : null)
          }
        />
      ))}

      {/* alignment guides */}
      {guides?.surface === surface.id &&
        guides.lines.map((g, i) =>
          g.axis === "x" ? (
            <div
              key={`x${i}`}
              className="pointer-events-none absolute z-50 w-px bg-signal/80"
              style={{
                left: (p.x + g.pos * p.w) * view.scale,
                top: p.y * view.scale,
                height: p.h * view.scale,
              }}
            />
          ) : (
            <div
              key={`y${i}`}
              className="pointer-events-none absolute z-50 h-px bg-signal/80"
              style={{
                left: p.x * view.scale,
                top: (p.y + g.pos * p.h) * view.scale,
                width: p.w * view.scale,
              }}
            />
          ),
        )}
    </div>
  );
})}
```

- [ ] **Step 2: Remove now-unused imports**

Remove `Plus` from the `@phosphor-icons/react` import and `AddComponentMenu` from `./add-component-menu`. The `ContentType` import from `@/lib/arc/content` is still needed (used in `addComponent` prop type).

Updated import block at the top:
```tsx
import {
  CornersOut,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/control/workspace/arc-stage.tsx
git commit -m "fix(stage): remove broken Add chip from surface edge"
```

---

## Task 2: Status Bar & Feed Settings Text Cleanup

**Files:**
- Modify: `components/control/workspace/status-bar.tsx`
- Modify: `components/control/workspace/arc-workspace.tsx` (remove unused config prop from call site)
- Modify: `components/control/feed-settings-section.tsx`

- [ ] **Step 1: Update status-bar.tsx**

Replace the entire file with:

```tsx
"use client";

import type { ConnectionStatus } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

const FEED_COPY: Record<ConnectionStatus, string> = {
  connecting: "feed connecting",
  live: "feed live",
  reconnecting: "feed reconnecting",
  polling: "feed polling",
  empty: "no athletes",
  error: "no feed",
  offline: "feed offline",
};

/** Slim footer: connection truth + feed status. */
export function StatusBar({
  online,
  feedStatus,
}: {
  online: boolean;
  feedStatus: ConnectionStatus;
}) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className={cn("size-1.5 rounded-full", online ? "bg-online" : "bg-muted-foreground")}
          aria-hidden
        />
        {online ? "Online" : "Offline"}
      </span>
      <Dot />
      <span>{FEED_COPY[feedStatus]}</span>
    </footer>
  );
}

function Dot() {
  return <span aria-hidden className="size-0.5 rounded-full bg-muted-foreground/60" />;
}
```

- [ ] **Step 2: Remove config prop from the StatusBar call site**

In `components/control/workspace/arc-workspace.tsx`, find the `<StatusBar ...>` call (around line 138) and remove the `config={config}` prop:

```tsx
<StatusBar online={online} feedStatus={status} />
```

- [ ] **Step 3: Update feed-settings-section.tsx STATUS_COPY**

Find the `STATUS_COPY` object (line 17) and replace it:

```tsx
const STATUS_COPY: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  polling: "Polling",
  empty: "Connected — no athletes yet",
  error: "No feed",
  offline: "Offline",
};
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add components/control/workspace/status-bar.tsx components/control/workspace/arc-workspace.tsx components/control/feed-settings-section.tsx
git commit -m "fix(ui): strip noisy status bar text and feed status labels"
```

---

## Task 3: Remove Clock Hint from Zone Content Editor

**Files:**
- Modify: `components/control/zone-content-editor.tsx`

- [ ] **Step 1: Remove the Hint element**

In `zone-content-editor.tsx`, find the `clock` case in the `ZoneFields` switch. Remove the `<Hint>` paragraph entirely. The result:

```tsx
case "clock":
  return (
    <div className="flex flex-col gap-2">
      <Toggle
        label="Animated digits (NumberFlow)"
        checked={content.numberFlow}
        onChange={(numberFlow) => onChange({ ...content, numberFlow })}
      />
    </div>
  );
```

- [ ] **Step 2: Remove the now-unused Hint component**

Delete the `Hint` function at the bottom of the file:

```tsx
// DELETE this:
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/control/zone-content-editor.tsx
git commit -m "fix(inspector): remove redundant clock hint text"
```

---

## Task 4: Tab Titles & Favicons

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/output/[surface]/page.tsx`

- [ ] **Step 1: Update the root layout title**

In `app/layout.tsx`, update the `metadata` export:

```tsx
export const metadata: Metadata = {
  title: "Arc Control · Lion Central",
  description: "Arc control & live feed for triathlon events.",
};
```

- [ ] **Step 2: Add generateMetadata to the output page**

Replace `app/output/[surface]/page.tsx` with:

```tsx
"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { use } from "react";

import { SurfaceOutput } from "@/components/arc/surface-output";
import { getSurface, isSurfaceId, SURFACES } from "@/lib/arc/surfaces";

const SURFACE_EMOJI: Record<string, string> = {
  clock: "🕐",
  topbar: "📺",
  "leg-left": "◀",
  "leg-right": "▶",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surface: string }>;
}): Promise<Metadata> {
  const { surface } = await params;
  if (!isSurfaceId(surface)) return { title: "Unknown Surface · Output" };
  const label = getSurface(surface)?.label ?? surface;
  const emoji = SURFACE_EMOJI[surface] ?? "🔲";
  const emojiSvg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`;
  return {
    title: `${label} · Output`,
    icons: { icon: emojiSvg },
  };
}

export default function OutputPage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  const { surface } = use(params);

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      {isSurfaceId(surface) ? (
        <SurfaceOutput surfaceId={surface} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-500">
          <p className="text-lg font-medium">Unknown surface "{surface}".</p>
          <p className="text-sm">
            Try:{" "}
            {SURFACES.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/output/${s.id}`} className="underline">
                  {s.id}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}
    </main>
  );
}
```

Note: `"use client"` and `generateMetadata` can coexist in Next.js App Router — `generateMetadata` runs server-side, the default export runs client-side.

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/output/[surface]/page.tsx
git commit -m "feat(meta): per-surface output tab titles and emoji favicons"
```

---

## Task 5: Folder Store (Server-side, TDD)

**Files:**
- Create: `lib/arc/asset-folders.ts`
- Create: `lib/arc/asset-folders.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `lib/arc/asset-folders.test.ts`:

```typescript
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createFolder,
  deleteFolder,
  moveAsset,
  readFolderMeta,
  renameFolder,
} from "./asset-folders";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lion-test-"));
  process.env.ASSETS_DIR = tmpDir;
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.ASSETS_DIR;
});

describe("readFolderMeta", () => {
  it("returns empty meta when no _folders.json exists", async () => {
    const meta = await readFolderMeta();
    expect(meta).toEqual({ folders: [], assetFolders: {} });
  });

  it("returns empty meta for invalid JSON", async () => {
    await fs.writeFile(path.join(tmpDir, "_folders.json"), "not json");
    const meta = await readFolderMeta();
    expect(meta).toEqual({ folders: [], assetFolders: {} });
  });
});

describe("createFolder", () => {
  it("adds a folder name", async () => {
    await createFolder("Sponsors");
    const meta = await readFolderMeta();
    expect(meta.folders).toContain("Sponsors");
  });

  it("is idempotent — duplicate create does not double-add", async () => {
    await createFolder("Sponsors");
    await createFolder("Sponsors");
    const meta = await readFolderMeta();
    expect(meta.folders.filter((f) => f === "Sponsors")).toHaveLength(1);
  });

  it("creates the assets dir if it does not exist", async () => {
    const nested = path.join(tmpDir, "sub");
    process.env.ASSETS_DIR = nested;
    await createFolder("Test");
    const meta = await readFolderMeta();
    expect(meta.folders).toContain("Test");
  });
});

describe("renameFolder", () => {
  it("renames folder and updates asset assignments", async () => {
    await createFolder("Old");
    await moveAsset("logo.png", "Old");
    await renameFolder("Old", "New");
    const meta = await readFolderMeta();
    expect(meta.folders).toContain("New");
    expect(meta.folders).not.toContain("Old");
    expect(meta.assetFolders["logo.png"]).toBe("New");
  });

  it("is a no-op for unknown folder", async () => {
    await renameFolder("Ghost", "New");
    const meta = await readFolderMeta();
    expect(meta.folders).not.toContain("New");
  });
});

describe("deleteFolder", () => {
  it("removes folder and unfiles its assets", async () => {
    await createFolder("ToDelete");
    await moveAsset("logo.png", "ToDelete");
    await deleteFolder("ToDelete");
    const meta = await readFolderMeta();
    expect(meta.folders).not.toContain("ToDelete");
    expect(meta.assetFolders["logo.png"]).toBeUndefined();
  });
});

describe("moveAsset", () => {
  it("assigns asset to folder", async () => {
    await createFolder("Sponsors");
    await moveAsset("logo.png", "Sponsors");
    const meta = await readFolderMeta();
    expect(meta.assetFolders["logo.png"]).toBe("Sponsors");
  });

  it("unfiles asset when folder is null", async () => {
    await createFolder("Sponsors");
    await moveAsset("logo.png", "Sponsors");
    await moveAsset("logo.png", null);
    const meta = await readFolderMeta();
    expect(meta.assetFolders["logo.png"]).toBeUndefined();
  });

  it("overwrites a prior folder assignment", async () => {
    await createFolder("A");
    await createFolder("B");
    await moveAsset("logo.png", "A");
    await moveAsset("logo.png", "B");
    const meta = await readFolderMeta();
    expect(meta.assetFolders["logo.png"]).toBe("B");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test
```

Expected: multiple failures — `Cannot find module './asset-folders'`.

- [ ] **Step 3: Implement asset-folders.ts**

Create `lib/arc/asset-folders.ts`:

```typescript
import { promises as fs } from "node:fs";
import path from "node:path";

function assetsDir(): string {
  return process.env.ASSETS_DIR ?? path.join(process.cwd(), ".lion-assets");
}

function metaPath(): string {
  return path.join(assetsDir(), "_folders.json");
}

export interface FolderMeta {
  folders: string[];
  assetFolders: Record<string, string>;
}

export async function readFolderMeta(): Promise<FolderMeta> {
  try {
    const raw = await fs.readFile(metaPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "folders" in parsed &&
      "assetFolders" in parsed &&
      Array.isArray((parsed as FolderMeta).folders) &&
      typeof (parsed as FolderMeta).assetFolders === "object"
    ) {
      return parsed as FolderMeta;
    }
  } catch {
    // file missing or corrupt — return empty
  }
  return { folders: [], assetFolders: {} };
}

async function writeFolderMeta(meta: FolderMeta): Promise<void> {
  await fs.mkdir(assetsDir(), { recursive: true });
  await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2));
}

export async function createFolder(name: string): Promise<void> {
  const meta = await readFolderMeta();
  if (meta.folders.includes(name)) return;
  meta.folders.push(name);
  await writeFolderMeta(meta);
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  const meta = await readFolderMeta();
  const idx = meta.folders.indexOf(oldName);
  if (idx < 0) return;
  meta.folders[idx] = newName;
  for (const id of Object.keys(meta.assetFolders)) {
    if (meta.assetFolders[id] === oldName) meta.assetFolders[id] = newName;
  }
  await writeFolderMeta(meta);
}

export async function deleteFolder(name: string): Promise<void> {
  const meta = await readFolderMeta();
  meta.folders = meta.folders.filter((f) => f !== name);
  for (const id of Object.keys(meta.assetFolders)) {
    if (meta.assetFolders[id] === name) delete meta.assetFolders[id];
  }
  await writeFolderMeta(meta);
}

export async function moveAsset(id: string, folder: string | null): Promise<void> {
  const meta = await readFolderMeta();
  if (folder === null) {
    delete meta.assetFolders[id];
  } else {
    meta.assetFolders[id] = folder;
  }
  await writeFolderMeta(meta);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test
```

Expected: all tests in `lib/arc/asset-folders.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add lib/arc/asset-folders.ts lib/arc/asset-folders.test.ts
git commit -m "feat(folders): server-side folder metadata store with tests"
```

---

## Task 6: Folders API Route

**Files:**
- Create: `app/api/assets/folders/route.ts`
- Modify: `app/api/assets/[id]/route.ts` (clean up folder metadata on delete)
- Modify: `app/api/assets/route.ts` (accept optional folder on upload)

- [ ] **Step 1: Create app/api/assets/folders/route.ts**

```typescript
import { type NextRequest, NextResponse } from "next/server";

import {
  createFolder,
  deleteFolder,
  moveAsset,
  readFolderMeta,
  renameFolder,
} from "@/lib/arc/asset-folders";

export const dynamic = "force-dynamic";

/** GET → the full folder meta: folder list + asset-to-folder map. */
export async function GET() {
  return NextResponse.json(await readFolderMeta());
}

/**
 * POST { action, ...args } → mutate folder metadata.
 * Actions: create, rename, delete, move.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  switch (action) {
    case "create": {
      const name = body.name;
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "name required" }, { status: 400 });
      }
      await createFolder(name.trim());
      return NextResponse.json({ ok: true });
    }
    case "rename": {
      const { oldName, newName } = body;
      if (typeof oldName !== "string" || typeof newName !== "string") {
        return NextResponse.json({ error: "oldName and newName required" }, { status: 400 });
      }
      await renameFolder(oldName, newName.trim());
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      const name = body.name;
      if (typeof name !== "string") {
        return NextResponse.json({ error: "name required" }, { status: 400 });
      }
      await deleteFolder(name);
      return NextResponse.json({ ok: true });
    }
    case "move": {
      const { id, folder } = body;
      if (typeof id !== "string") {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      await moveAsset(id, typeof folder === "string" ? folder : null);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Update the DELETE handler in app/api/assets/[id]/route.ts**

Add `moveAsset` import and clean up folder membership on delete. Replace the `DELETE` function:

```typescript
import { contentTypeFor, deleteAsset, isValidAssetId, readAsset } from "@/lib/arc/assets-store";
import { moveAsset } from "@/lib/arc/asset-folders";

// ... existing GET handler unchanged ...

/** DELETE → remove the logo from the library and unfile it from any folder. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidAssetId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await deleteAsset(id);
  await moveAsset(id, null);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Update POST in app/api/assets/route.ts to accept optional folder**

Replace the POST handler:

```typescript
import { NextResponse } from "next/server";

import { moveAsset } from "@/lib/arc/asset-folders";
import { listAssets, saveDataUrl } from "@/lib/arc/assets-store";

export const dynamic = "force-dynamic";

/** GET → the logo library (newest first). */
export async function GET() {
  return NextResponse.json({ assets: await listAssets() });
}

/**
 * POST { name, dataUrl, folder? } → store an uploaded logo.
 * If `folder` is provided, assigns the new asset to that folder.
 */
export async function POST(request: Request) {
  let body: { name?: unknown; dataUrl?: unknown; folder?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, dataUrl, folder } = body;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Expected an image data URL" }, { status: 400 });
  }

  try {
    const asset = await saveDataUrl(dataUrl, typeof name === "string" ? name : "logo");
    if (typeof folder === "string" && folder.trim()) {
      await moveAsset(asset.id, folder.trim());
    }
    return NextResponse.json({ asset });
  } catch {
    return NextResponse.json({ error: "Could not save the logo" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add app/api/assets/folders/route.ts app/api/assets/[id]/route.ts app/api/assets/route.ts
git commit -m "feat(api): folders CRUD endpoint, folder-aware upload and delete"
```

---

## Task 7: Extend useLogoLibrary Hook

**Files:**
- Modify: `hooks/use-logo-library.ts`

- [ ] **Step 1: Replace the entire hook**

```typescript
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

async function folderAction(body: Record<string, unknown>): Promise<void> {
  await fetch("/api/assets/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * The shared, server-persisted media library. Manages assets and folder
 * metadata through `/api/assets` and `/api/assets/folders`.
 */
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
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-logo-library.ts
git commit -m "feat(hook): extend useLogoLibrary with folder operations"
```

---

## Task 8: Dialog UI Component

**Files:**
- Create: `components/ui/dialog.tsx`

- [ ] **Step 1: Create the Dialog component**

```tsx
"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

function DialogBackdrop({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm",
        "transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        "motion-reduce:transition-none",
        className,
      )}
    />
  );
}

function DialogPopup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl shadow-black/60 outline-none",
          "transition-[transform,opacity]",
          "data-[starting-style]:-translate-x-1/2 data-[starting-style]:-translate-y-[48%] data-[starting-style]:opacity-0",
          "data-[ending-style]:-translate-x-1/2 data-[ending-style]:-translate-y-[48%] data-[ending-style]:opacity-0",
          "motion-reduce:transition-none",
          className,
        )}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Title
      className={cn("text-sm font-semibold text-foreground", className)}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

function DialogClose({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className={cn(
        "grid size-7 place-items-center rounded-md text-muted-foreground outline-none",
        "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "[&_svg]:size-4",
        className,
      )}
    >
      <X />
    </DialogPrimitive.Close>
  );
}

export { Dialog, DialogTrigger, DialogPopup, DialogTitle, DialogClose };
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/dialog.tsx
git commit -m "feat(ui): add Dialog component via @base-ui/react"
```

---

## Task 9: AssetTile + AssetGrid Components

**Files:**
- Create: `components/control/media-library/asset-tile.tsx`
- Create: `components/control/media-library/asset-grid.tsx`

- [ ] **Step 1: Create asset-tile.tsx**

```tsx
"use client";

import { Check, FolderSimple, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import type { AssetInfo } from "@/lib/arc/assets-store";
import { cn } from "@/lib/utils";

export function AssetTile({
  asset,
  selected,
  folders,
  onPick,
  onDelete,
  onMove,
}: {
  asset: AssetInfo;
  selected: boolean;
  folders: string[];
  onPick: (url: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folder: string | null) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group relative flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onPick(asset.url)}
        title={asset.name}
        className={cn(
          "grid aspect-square w-full place-items-center overflow-hidden rounded-lg border bg-[#1c1f26] p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-signal ring-1 ring-signal"
            : "border-input hover:border-foreground/40",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logo, not a build asset */}
        <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
      </button>

      {selected && (
        <span className="pointer-events-none absolute left-1 top-1 grid size-4 place-items-center rounded-full bg-signal text-background">
          <Check weight="bold" className="size-2.5" />
        </span>
      )}

      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {folders.length > 0 && (
          <Menu>
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Move to folder"
                  className="grid size-5 place-items-center rounded bg-background/90 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
                >
                  <FolderSimple />
                </button>
              }
            />
            <MenuContent side="bottom" align="end">
              <MenuLabel>Move to</MenuLabel>
              <MenuItem onClick={() => onMove(asset.id, null)}>Unfiled</MenuItem>
              <MenuSeparator />
              {folders.map((f) => (
                <MenuItem key={f} onClick={() => onMove(asset.id, f)}>
                  {f}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}

        {confirmDelete ? (
          <button
            type="button"
            aria-label="Confirm delete"
            onClick={() => {
              setConfirmDelete(false);
              onDelete(asset.id);
            }}
            className="grid size-5 place-items-center rounded bg-destructive/90 text-white outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
          >
            <Trash />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${asset.name}`}
            onClick={() => setConfirmDelete(true)}
            onBlur={() => setConfirmDelete(false)}
            className="grid size-5 place-items-center rounded bg-background/90 text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
          >
            <Trash />
          </button>
        )}
      </div>

      <p className="truncate px-0.5 text-center text-[10px] text-muted-foreground" title={asset.name}>
        {asset.name}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create asset-grid.tsx**

```tsx
"use client";

import type { AssetInfo } from "@/lib/arc/assets-store";

import { AssetTile } from "./asset-tile";

export function AssetGrid({
  assets,
  selected,
  folders,
  onPick,
  onDelete,
  onMove,
}: {
  assets: AssetInfo[];
  selected: string[];
  folders: string[];
  onPick: (url: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folder: string | null) => void;
}) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No assets here yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
      {assets.map((a) => (
        <AssetTile
          key={a.id}
          asset={a}
          selected={selected.includes(a.url)}
          folders={folders}
          onPick={onPick}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/control/media-library/asset-tile.tsx components/control/media-library/asset-grid.tsx
git commit -m "feat(media-library): AssetTile and AssetGrid components"
```

---

## Task 10: FolderSidebar Component

**Files:**
- Create: `components/control/media-library/folder-sidebar.tsx`

- [ ] **Step 1: Create folder-sidebar.tsx**

```tsx
"use client";

import { FolderSimple, FolderSimplePlus, PencilSimple, Trash } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function FolderSidebar({
  folders,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: string[];
  active: string | null;
  onSelect: (folder: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (old: string, next: string) => void;
  onDelete: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  const commitCreate = () => {
    const name = newName.trim();
    if (name) onCreate(name);
    setNewName("");
    setCreating(false);
  };

  const startRename = (folder: string) => {
    setRenamingFolder(folder);
    setRenameValue(folder);
    setTimeout(() => renameRef.current?.select(), 0);
  };

  const commitRename = () => {
    const next = renameValue.trim();
    if (next && next !== renamingFolder && renamingFolder) {
      onRename(renamingFolder, next);
      if (active === renamingFolder) onSelect(next);
    }
    setRenamingFolder(null);
  };

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-2" aria-label="Folders">
      <SidebarItem label="All" active={active === null} onClick={() => onSelect(null)} />
      <SidebarItem label="Unfiled" active={active === ""} onClick={() => onSelect("")} />

      {folders.length > 0 && <hr className="my-1.5 border-border" />}

      {folders.map((folder) => (
        <div key={folder} className="group relative flex items-center">
          {renamingFolder === folder ? (
            <input
              ref={renameRef}
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingFolder(null);
              }}
              className="h-7 w-full rounded-md border border-ring bg-background px-2 text-xs outline-none"
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSelect(folder)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none transition-colors",
                  active === folder
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <FolderSimple className="size-3.5 shrink-0" />
                <span className="flex-1 truncate">{folder}</span>
              </button>
              <div className="absolute right-1 hidden items-center gap-0.5 group-hover:flex">
                <button
                  type="button"
                  aria-label={`Rename ${folder}`}
                  onClick={(e) => { e.stopPropagation(); startRename(folder); }}
                  className="grid size-5 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
                >
                  <PencilSimple />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${folder}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
                  className="grid size-5 place-items-center rounded text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
                >
                  <Trash />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      <hr className="my-1.5 border-border" />

      {creating ? (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitCreate();
            if (e.key === "Escape") { setCreating(false); setNewName(""); }
          }}
          placeholder="Folder name…"
          className="h-7 w-full rounded-md border border-ring bg-background px-2 text-xs outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground"
        >
          <FolderSimplePlus className="size-3.5 shrink-0" />
          New folder
        </button>
      )}
    </nav>
  );
}

function SidebarItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center rounded-md px-2 text-left text-xs outline-none transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/control/media-library/folder-sidebar.tsx
git commit -m "feat(media-library): FolderSidebar component"
```

---

## Task 11: UploadZone Component

**Files:**
- Create: `components/control/media-library/upload-zone.tsx`

- [ ] **Step 1: Create upload-zone.tsx**

```tsx
"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function UploadZone({
  folder,
  onUpload,
}: {
  folder: string | null;
  onUpload: (files: FileList | File[], folder: string | null) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      await onUpload(files, folder);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors",
        dragging && "border-signal bg-signal/5",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); }}
      />
      <UploadSimple className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-sm font-medium text-foreground outline-none hover:underline focus-visible:underline disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Click to upload"}
        </button>
        <p className="text-xs text-muted-foreground">or drag & drop · images only</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/control/media-library/upload-zone.tsx
git commit -m "feat(media-library): UploadZone with drag-and-drop"
```

---

## Task 12: MediaLibraryModal + MediaLibraryTrigger

**Files:**
- Create: `components/control/media-library/modal.tsx`
- Create: `components/control/media-library/index.tsx`

- [ ] **Step 1: Create modal.tsx**

```tsx
"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Dialog, DialogClose, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { useLogoLibrary } from "@/hooks/use-logo-library";

import { AssetGrid } from "./asset-grid";
import { FolderSidebar } from "./folder-sidebar";
import { UploadZone } from "./upload-zone";

export function MediaLibraryModal({
  open,
  onOpenChange,
  mode,
  selected,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "single" | "multi";
  selected: string[];
  onPick: (url: string) => void;
}) {
  const {
    assets,
    loading,
    error,
    folders,
    assetFolders,
    upload,
    remove,
    createFolder,
    renameFolder,
    deleteFolder,
    moveAsset,
  } = useLogoLibrary();

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeFolder === "") {
      list = list.filter((a) => !assetFolders[a.id]);
    } else if (activeFolder !== null) {
      list = list.filter((a) => assetFolders[a.id] === activeFolder);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [assets, activeFolder, assetFolders, search]);

  const handlePick = (url: string) => {
    onPick(url);
    if (mode === "single") onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex h-[80vh] w-[min(900px,90vw)] flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <DialogTitle>Media library</DialogTitle>
          <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5">
            <MagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <DialogClose />
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Folder sidebar */}
          <aside className="w-40 shrink-0 overflow-y-auto border-r border-border">
            <FolderSidebar
              folders={folders}
              active={activeFolder}
              onSelect={setActiveFolder}
              onCreate={(name) => void createFolder(name)}
              onRename={(old, next) => void renameFolder(old, next)}
              onDelete={(name) => void deleteFolder(name)}
            />
          </aside>

          {/* Asset grid + upload */}
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <AssetGrid
                assets={filteredAssets}
                selected={selected}
                folders={folders}
                onPick={handlePick}
                onDelete={(id) => void remove(id)}
                onMove={(id, folder) => void moveAsset(id, folder)}
              />
            )}
            <UploadZone
              folder={activeFolder === "" ? null : activeFolder}
              onUpload={(files, folder) => upload(files, folder ?? undefined)}
            />
          </main>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create index.tsx**

```tsx
"use client";

import { Images } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { MediaLibraryModal } from "./modal";

export function MediaLibraryTrigger({
  mode,
  selected,
  onPick,
}: {
  mode: "single" | "multi";
  selected: string[];
  onPick: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.filter(Boolean).length;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Images />
        Browse library{count > 0 ? ` (${count} selected)` : ""}
      </Button>
      <MediaLibraryModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        selected={selected}
        onPick={onPick}
      />
    </>
  );
}

export { MediaLibraryModal };
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/control/media-library/modal.tsx components/control/media-library/index.tsx
git commit -m "feat(media-library): MediaLibraryModal and MediaLibraryTrigger"
```

---

## Task 13: Wire Into Zone Content Editor & Remove Old Logo Library

**Files:**
- Modify: `components/control/zone-content-editor.tsx`
- Delete: `components/control/logo-library.tsx`

- [ ] **Step 1: Update zone-content-editor.tsx imports**

Remove the `LogoLibrary` import and add `MediaLibraryTrigger`:

```tsx
// Remove:
import { LogoLibrary } from "@/components/control/logo-library";

// Add:
import { MediaLibraryTrigger } from "@/components/control/media-library";
```

- [ ] **Step 2: Replace LogoLibrary in the image case**

Find the `case "image":` block. Replace `<LogoLibrary ... />`:

```tsx
case "image":
  return (
    <div className="flex flex-col gap-3">
      <ImageCropEditor
        src={content.src}
        transform={content}
        aspect={aspect}
        onChange={(t) => onChange({ ...content, ...t })}
        onSrcChange={(src) => onChange({ ...content, src })}
      />
      <MediaLibraryTrigger
        mode="single"
        selected={content.src ? [content.src] : []}
        onPick={(url) => onChange({ ...content, src: content.src === url ? "" : url })}
      />
    </div>
  );
```

- [ ] **Step 3: Replace LogoLibrary in the sponsors case**

In `SponsorFields`, find `<LogoLibrary onPick={toggle} selected={srcs} />` and replace:

```tsx
<MediaLibraryTrigger mode="multi" selected={srcs} onPick={toggle} />
```

- [ ] **Step 4: Delete logo-library.tsx**

```bash
rm "components/control/logo-library.tsx"
```

- [ ] **Step 5: Verify**

```bash
pnpm typecheck
```

Expected: zero errors. The `LogoLibrary` component is now fully replaced.

- [ ] **Step 6: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/control/zone-content-editor.tsx
git rm components/control/logo-library.tsx
git commit -m "feat(media-library): wire MediaLibraryTrigger into inspector, remove LogoLibrary"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 2: Full test suite**

```bash
pnpm test
```

Expected: all tests pass, including `lib/arc/asset-folders.test.ts`.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Fix any lint errors before marking done.

- [ ] **Step 4: Commit any lint fixes if needed**

```bash
git add -p
git commit -m "fix(lint): address lint warnings post-media-library"
```

---

## File Map Summary

| File | Action |
|---|---|
| `components/control/workspace/arc-stage.tsx` | Remove Add chip + unused imports |
| `components/control/workspace/status-bar.tsx` | Strip noisy text |
| `components/control/feed-settings-section.tsx` | Strip `(push)`/`(polling)` |
| `components/control/zone-content-editor.tsx` | Remove Hint; swap LogoLibrary → MediaLibraryTrigger |
| `app/layout.tsx` | Updated title |
| `app/output/[surface]/page.tsx` | Add generateMetadata + emoji favicons |
| `lib/arc/asset-folders.ts` | **New** — folder CRUD |
| `lib/arc/asset-folders.test.ts` | **New** — folder tests |
| `app/api/assets/folders/route.ts` | **New** — folder API |
| `app/api/assets/[id]/route.ts` | Add folder cleanup on delete |
| `app/api/assets/route.ts` | Accept folder on upload |
| `hooks/use-logo-library.ts` | Add folder ops + assetFolders state |
| `components/ui/dialog.tsx` | **New** — Dialog via @base-ui/react |
| `components/control/media-library/asset-tile.tsx` | **New** |
| `components/control/media-library/asset-grid.tsx` | **New** |
| `components/control/media-library/folder-sidebar.tsx` | **New** |
| `components/control/media-library/upload-zone.tsx` | **New** |
| `components/control/media-library/modal.tsx` | **New** |
| `components/control/media-library/index.tsx` | **New** |
| `components/control/logo-library.tsx` | **Delete** |
