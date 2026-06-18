# UI Polish, Media Library & Preview Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UI inconsistencies (checkbox → Switch), add drag-to-folder + video support to the media library, and add a 15-second docked preview mode when a logo is placed on the arc.

**Architecture:** Isolated changes across the component tree — UI primitives first (Switch, Dialog extensions), then media library enhancements (drag + video), then preview mode wiring. No new dependencies required; all video thumbnail extraction uses the native browser Canvas API.

**Tech Stack:** Next.js App Router, TypeScript, `@base-ui/react` (Switch, Dialog), Tailwind CSS, HTML5 Drag and Drop API, browser Canvas API (`drawImage`), vitest (pure-logic unit tests only).

---

## File Map

| File | Change |
|---|---|
| `components/ui/switch.tsx` | **New** — Switch primitive (Root + Thumb via `@base-ui/react/switch`) |
| `components/ui/dialog.tsx` | Add `backdropHidden` + `positionStyle` props |
| `components/control/workspace/appearance-popover.tsx` | Fix hex input overflow |
| `components/control/zone-content-editor.tsx` | Replace `Toggle` + raw checkbox with `Switch` |
| `lib/arc/assets-store.ts` | Add video MIME types + `isVideoAsset()` helper |
| `components/control/media-library/upload-zone.tsx` | Accept `video/*` in file input |
| `components/control/media-library/asset-tile.tsx` | Add `draggable`, drag events, `VideoThumbnail` subcomponent |
| `components/control/media-library/folder-sidebar.tsx` | Add `onMove` prop, drop targets on folder items |
| `components/control/media-library/modal.tsx` | Thread `onMove`; add `previewActive` state + 15s timer; pass preview props to `DialogPopup` |

---

## Task 1: Fix appearance popover hex overflow

**Files:**
- Modify: `components/control/workspace/appearance-popover.tsx`

- [ ] **Step 1: Open the file and locate the hex input**

Read `components/control/workspace/appearance-popover.tsx`. The hex text input is inside a `flex items-center gap-2` div alongside the `type="color"` swatch.

- [ ] **Step 2: Apply the fix**

Replace:
```tsx
          <input
            type="text"
            value={background}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Background hex"
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
```

With:
```tsx
          <input
            type="text"
            value={background}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Background hex"
            maxLength={7}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
```

Also constrain the color swatch — replace:
```tsx
            className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background"
```
With:
```tsx
            className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background"
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/control/workspace/appearance-popover.tsx
git commit -m "fix(ui): constrain appearance popover hex input overflow"
```

---

## Task 2: Create Switch primitive

**Files:**
- Create: `components/ui/switch.tsx`

- [ ] **Step 1: Create the Switch component**

Create `components/ui/switch.tsx` with this content:

```tsx
"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * A styled toggle switch. Uses Base UI Switch under the hood.
 * Renders inline: label text on the left, pill track on the right.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 text-sm",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span>{label}</span>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-input bg-input outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "data-[checked]:border-signal data-[checked]:bg-signal",
          "disabled:cursor-not-allowed",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform",
            "translate-x-0.5 data-[checked]:translate-x-[18px]",
          )}
        />
      </SwitchPrimitive.Root>
    </label>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/switch.tsx
git commit -m "feat(ui): add Switch primitive via @base-ui/react/switch"
```

---

## Task 3: Replace Toggle with Switch in zone-content-editor

**Files:**
- Modify: `components/control/zone-content-editor.tsx`

- [ ] **Step 1: Add the Switch import**

At the top of `components/control/zone-content-editor.tsx`, add:
```tsx
import { Switch } from "@/components/ui/switch";
```

- [ ] **Step 2: Replace the `Toggle` helper and its three call sites**

Remove the entire `Toggle` function at the bottom of the file (lines ~282–300):
```tsx
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}
```

In the `clock` case of `ZoneFields`, replace:
```tsx
        <Toggle
            label="Animated digits (NumberFlow)"
            checked={content.numberFlow}
            onChange={(numberFlow) => onChange({ ...content, numberFlow })}
          />
```
With:
```tsx
        <Switch
            label="Animated digits (NumberFlow)"
            checked={content.numberFlow}
            onCheckedChange={(numberFlow) => onChange({ ...content, numberFlow })}
          />
```

In `VideoFields`, replace both `Toggle` usages:
```tsx
      <div className="flex gap-4">
        <Toggle label="Loop" checked={content.loop} onChange={(loop) => onChange({ ...content, loop })} />
        <Toggle label="Muted" checked={content.muted} onChange={(muted) => onChange({ ...content, muted })} />
      </div>
```
With:
```tsx
      <div className="flex flex-col gap-2">
        <Switch label="Loop" checked={content.loop} onCheckedChange={(loop) => onChange({ ...content, loop })} />
        <Switch label="Muted" checked={content.muted} onCheckedChange={(muted) => onChange({ ...content, muted })} />
      </div>
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/control/zone-content-editor.tsx components/ui/switch.tsx
git commit -m "feat(ui): replace raw checkbox Toggle with Switch component"
```

---

## Task 4: Add video MIME types to assets-store

**Files:**
- Modify: `lib/arc/assets-store.ts`
- Test: `lib/arc/assets-store.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `lib/arc/assets-store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isVideoAsset, contentTypeFor } from "./assets-store";

describe("isVideoAsset", () => {
  it("returns true for .mp4", () => {
    expect(isVideoAsset("abc123__video.mp4")).toBe(true);
  });
  it("returns true for .webm", () => {
    expect(isVideoAsset("abc123__clip.webm")).toBe(true);
  });
  it("returns true for .mov", () => {
    expect(isVideoAsset("abc123__recording.mov")).toBe(true);
  });
  it("returns false for .png", () => {
    expect(isVideoAsset("abc123__logo.png")).toBe(false);
  });
  it("returns false for .svg", () => {
    expect(isVideoAsset("abc123__icon.svg")).toBe(false);
  });
});

describe("contentTypeFor — video extensions", () => {
  it("maps .mp4 to video/mp4", () => {
    expect(contentTypeFor("abc123__video.mp4")).toBe("video/mp4");
  });
  it("maps .webm to video/webm", () => {
    expect(contentTypeFor("abc123__clip.webm")).toBe("video/webm");
  });
  it("maps .mov to video/quicktime", () => {
    expect(contentTypeFor("abc123__rec.mov")).toBe("video/quicktime");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test lib/arc/assets-store.test.ts
```
Expected: FAIL — `isVideoAsset is not a function` (it doesn't exist yet).

- [ ] **Step 3: Add video MIME types and `isVideoAsset` to assets-store**

In `lib/arc/assets-store.ts`, extend `CONTENT_TYPES`:
```ts
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};
```

Extend `EXT_FROM_MIME`:
```ts
const EXT_FROM_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};
```

Add the helper after `contentTypeFor`:
```ts
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

export function isVideoAsset(id: string): boolean {
  return VIDEO_EXTS.has(path.extname(id).toLowerCase());
}
```

Also update `listAssets` — currently it filters by `contentType.startsWith("image/")`. Update to include video:
```ts
  const withTime = await Promise.all(
    entries
      .filter((f) => {
        const ct = contentTypeFor(f);
        return ct.startsWith("image/") || ct.startsWith("video/");
      })
      .map(async (f) => {
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test lib/arc/assets-store.test.ts
```
Expected: all 8 tests PASS.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/arc/assets-store.ts lib/arc/assets-store.test.ts
git commit -m "feat(assets): add video MIME types and isVideoAsset helper"
```

---

## Task 5: Accept video uploads in upload-zone

**Files:**
- Modify: `components/control/media-library/upload-zone.tsx`

- [ ] **Step 1: Read the current upload-zone**

Read `components/control/media-library/upload-zone.tsx` and find the `<input type="file">` element.

- [ ] **Step 2: Update the accept attribute**

Find the file input's `accept` attribute (currently `"image/*"` or similar) and replace with:
```tsx
accept="image/*,video/mp4,video/webm,video/quicktime"
```

Also update the drag-and-drop `onDrop` handler if it filters by MIME type — replace any `file.type.startsWith("image/")` check with:
```ts
file.type.startsWith("image/") || file.type.startsWith("video/")
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/control/media-library/upload-zone.tsx
git commit -m "feat(media-library): accept video file uploads"
```

---

## Task 6: Add VideoThumbnail subcomponent to asset-tile

**Files:**
- Modify: `components/control/media-library/asset-tile.tsx`

- [ ] **Step 1: Add imports**

At the top of `components/control/media-library/asset-tile.tsx`, add:
```tsx
import { Play } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { isVideoAsset } from "@/lib/arc/assets-store";
```

Note: `useState` is already imported — just add `useEffect` if missing.

- [ ] **Step 2: Add the VideoThumbnail subcomponent**

Add this function before `AssetTile` (or after it — just within the same file):

```tsx
function VideoThumbnail({ url }: { url: string }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      video.currentTime = 0.1;
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const w = Math.min(video.videoWidth, 160);
      const h = Math.round((w / video.videoWidth) * video.videoHeight);
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
      setThumb(canvas.toDataURL("image/jpeg", 0.8));
      video.src = "";
    };
    return () => {
      video.src = "";
    };
  }, [url]);

  return (
    <div className="relative grid h-full w-full place-items-center">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="size-8 animate-pulse rounded bg-muted" />
      )}
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <Play weight="fill" className="size-4 text-white opacity-90 drop-shadow" />
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Use VideoThumbnail in AssetTile**

In `AssetTile`, find the `<img>` element inside the button:
```tsx
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logo, not a build asset */}
        <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
```

Replace with a conditional:
```tsx
        {isVideoAsset(asset.id) ? (
          <VideoThumbnail url={asset.url} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded logo, not a build asset
          <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
        )}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/control/media-library/asset-tile.tsx
git commit -m "feat(media-library): show first-frame thumbnail for video assets"
```

---

## Task 7: Add drag behaviour to asset tiles

**Files:**
- Modify: `components/control/media-library/asset-tile.tsx`

- [ ] **Step 1: Add dragging state and drag event handlers**

In `AssetTile`, add a `dragging` state at the top of the component:
```tsx
  const [dragging, setDragging] = useState(false);
```

Add drag event handlers to the outer wrapper `div` (the one that already has `className="group relative flex flex-col gap-1"`):

```tsx
    <div
      className={cn("group relative flex flex-col gap-1", dragging && "opacity-50")}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("assetId", asset.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/control/media-library/asset-tile.tsx
git commit -m "feat(media-library): make asset tiles draggable (HTML5 drag API)"
```

---

## Task 8: Add drop targets to folder sidebar

**Files:**
- Modify: `components/control/media-library/folder-sidebar.tsx`

- [ ] **Step 1: Add `onMove` to the FolderSidebar props interface**

In `FolderSidebar`, add `onMove: (id: string, folder: string | null) => void` to the props:

```tsx
export function FolderSidebar({
  folders,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: {
  folders: string[];
  active: string | null;
  onSelect: (folder: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (old: string, next: string) => void;
  onDelete: (name: string) => void;
  onMove: (id: string, folder: string | null) => void;
}) {
```

- [ ] **Step 2: Add drop target state and a shared handler**

Add a `dropTarget` state inside the component and a helper:
```tsx
  const [dropTarget, setDropTarget] = useState<string | null | "none">("none");

  const handleDrop = (e: React.DragEvent, folder: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("assetId");
    if (id) onMove(id, folder);
    setDropTarget("none");
  };

  const dragOverProps = (folder: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(folder ?? "__unfiled__");
    },
    onDragLeave: () => setDropTarget("none"),
    onDrop: (e: React.DragEvent) => handleDrop(e, folder),
  });
```

- [ ] **Step 3: Update SidebarItem to accept drop props**

Update the `SidebarItem` function signature and element to accept and spread drag props:

```tsx
function SidebarItem({
  label,
  active,
  onClick,
  isDropTarget,
  dragProps,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  isDropTarget?: boolean;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...dragProps}
      className={cn(
        "flex h-7 items-center rounded-md px-2 text-left text-xs outline-none transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        isDropTarget && "ring-1 ring-amber-400",
      )}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Wire drop props to "Unfiled" sidebar item**

Replace the existing `<SidebarItem label="Unfiled" ...>` line with:
```tsx
      <SidebarItem
        label="Unfiled"
        active={active === ""}
        onClick={() => onSelect("")}
        isDropTarget={dropTarget === "__unfiled__"}
        dragProps={dragOverProps(null)}
      />
```

- [ ] **Step 5: Wire drop props to named folder buttons**

Find the folder button inside the `folders.map(...)` block. Add drop props and a ring highlight. Replace the folder `<button>` with:

```tsx
              <button
                type="button"
                onClick={() => onSelect(folder)}
                {...dragOverProps(folder)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none transition-colors",
                  active === folder
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  dropTarget === folder && "ring-1 ring-amber-400",
                )}
              >
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/control/media-library/folder-sidebar.tsx
git commit -m "feat(media-library): add drop targets to folder sidebar for drag-to-folder"
```

---

## Task 9: Thread onMove from modal into FolderSidebar

**Files:**
- Modify: `components/control/media-library/modal.tsx`

- [ ] **Step 1: Pass `moveAsset` as `onMove` to FolderSidebar**

In `components/control/media-library/modal.tsx`, `moveAsset` is already destructured from `useLogoLibrary()`. Find the `<FolderSidebar>` usage and add the `onMove` prop:

```tsx
            <FolderSidebar
              folders={folders}
              active={activeFolder}
              onSelect={setActiveFolder}
              onCreate={(name) => void createFolder(name)}
              onRename={(old, next) => void renameFolder(old, next)}
              onDelete={(name) => void deleteFolder(name)}
              onMove={(id, folder) => void moveAsset(id, folder)}
            />
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/control/media-library/modal.tsx
git commit -m "feat(media-library): wire drag-to-folder — thread moveAsset into FolderSidebar"
```

---

## Task 10: Extend DialogPopup with backdropHidden and positionStyle

**Files:**
- Modify: `components/ui/dialog.tsx`

- [ ] **Step 1: Update DialogBackdrop to accept a `hidden` prop**

In `components/ui/dialog.tsx`, update `DialogBackdrop`:

```tsx
function DialogBackdrop({ className, hidden }: { className?: string; hidden?: boolean }) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-40",
        hidden
          ? "pointer-events-none bg-transparent"
          : "bg-black/60 backdrop-blur-sm",
        "transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        "motion-reduce:transition-none",
        className,
      )}
    />
  );
}
```

- [ ] **Step 2: Update DialogPopup to accept `backdropHidden` and `positionStyle`**

Replace the existing `DialogPopup` function:

```tsx
function DialogPopup({
  children,
  className,
  backdropHidden,
  positionStyle,
}: {
  children: React.ReactNode;
  className?: string;
  backdropHidden?: boolean;
  positionStyle?: React.CSSProperties;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop hidden={backdropHidden} />
      <DialogPrimitive.Popup
        className={cn(
          "fixed z-50 rounded-xl border border-border bg-card shadow-2xl shadow-black/60 outline-none",
          "transition-[left,top,width,height,transform,opacity] duration-300 ease-in-out",
          !positionStyle && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "data-[starting-style]:opacity-0",
          "data-[ending-style]:opacity-0",
          "motion-reduce:transition-none",
          className,
        )}
        style={positionStyle}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}
```

Note: the `data-[starting-style]:-translate-x-1/2 data-[starting-style]:-translate-y-[48%]` classes from the original are removed because they conflict with the conditional centered positioning. Base UI's open/close animation now relies on the `opacity` transition only.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/dialog.tsx
git commit -m "feat(dialog): add backdropHidden and positionStyle props for preview mode"
```

---

## Task 11: Add preview mode to MediaLibraryModal

**Files:**
- Modify: `components/control/media-library/modal.tsx`

- [ ] **Step 1: Add imports and preview state**

At the top of `components/control/media-library/modal.tsx`, ensure `useEffect` and `useRef` are imported from React:
```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

Inside `MediaLibraryModal`, add after the existing state declarations:
```tsx
  const [previewActive, setPreviewActive] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);
```

- [ ] **Step 2: Modify handlePick to enter preview mode**

Replace the existing `handlePick` function:
```tsx
  const handlePick = (url: string) => {
    onPick(url);
    if (mode === "single") {
      setPreviewActive(true);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => {
        setPreviewActive(false);
      }, 15_000);
    }
  };
```

In multi mode (`mode === "multi"`), the existing `if (mode === "single") onOpenChange(false)` logic is gone — multi mode never auto-closes and never enters preview mode. The new `handlePick` handles both cases: multi mode just fires `onPick` and does nothing else.

- [ ] **Step 3: Compute the preview position style**

Add this computed value inside the component (after `previewActive` state):

```tsx
  const previewPositionStyle: React.CSSProperties | undefined = previewActive
    ? {
        right: "1rem",
        top: "3.5rem",
        left: "auto",
        width: "340px",
        height: "calc(100dvh - 4.5rem)",
        transform: "none",
      }
    : undefined;
```

- [ ] **Step 4: Update DialogPopup usage**

Find the `<DialogPopup>` element. Currently it has:
```tsx
      <DialogPopup className="flex h-[80vh] w-[min(900px,90vw)] flex-col overflow-hidden">
```

Replace with:
```tsx
      <DialogPopup
        className={cn(
          "flex flex-col overflow-hidden",
          !previewActive && "h-[80vh] w-[min(900px,90vw)]",
        )}
        backdropHidden={previewActive}
        positionStyle={previewPositionStyle}
      >
```

Add `cn` to the imports at the top if not already present — it comes from `@/lib/utils`.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 6: Run lint**

```bash
pnpm lint
```
Expected: no errors or warnings.

- [ ] **Step 7: Commit**

```tsx
git add components/control/media-library/modal.tsx
git commit -m "feat(media-library): preview mode — modal docks to right for 15s after logo pick"
```

---

## Task 12: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Test Switch**

Open the inspector (select a component). Set it to "Clock" — verify the "Animated digits" row now shows a pill toggle switch (not a checkbox). Toggle it — should flip between on/off with amber color when on.

Set to "Video" — verify "Loop" and "Muted" are also pill switches.

- [ ] **Step 3: Test appearance popover**

Click the palette icon (top-right of toolbar). Verify the hex input doesn't overflow the popover. Type a color like `#ff0000` — arc background should update live.

- [ ] **Step 4: Test video upload**

Open the media library (click "Browse library" in an image or sponsors inspector). Upload an MP4 file. Verify:
- It appears in the grid
- A first-frame thumbnail is extracted and shown with a play icon overlay
- If thumbnail extraction takes a second, a pulsing gray placeholder shows first

- [ ] **Step 5: Test drag-to-folder**

With at least one folder and one asset in the library, drag an asset tile onto a folder name in the sidebar. Verify the folder name gets an amber ring while hovering and the asset moves to that folder on drop.

Drag to "Unfiled" — asset should move to root.

- [ ] **Step 6: Test preview mode**

Set a component to "Image" type. Click "Browse library". Click any image tile (single mode). Verify:
- Modal slides to the right side of the screen (340px wide panel)
- Backdrop/blur disappears
- Arc stage is fully visible and interactive (can click components on stage)
- After 15 seconds, the modal slides back to center with backdrop restored
- Clicking another image tile during the 15s window resets the timer

- [ ] **Step 7: Final commit if any fixups were needed**

```bash
git add -p
git commit -m "fix: smoke test fixups"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 1a. Appearance popover hex → Task 1
- ✅ 1b. Switch component → Tasks 2 + 3
- ✅ 1c. Select elements → explicitly out of scope in spec
- ✅ 2a. Drag-to-folder → Tasks 7 + 8 + 9
- ✅ 2b. Video MIME types → Task 4
- ✅ 2b. Upload-zone video accept → Task 5
- ✅ 2b. VideoThumbnail subcomponent → Task 6
- ✅ 3b. DialogPopup extensions → Task 10
- ✅ 3c. Preview mode in modal → Task 11
- ✅ Manual testing → Task 12

**Type consistency check:**
- `isVideoAsset` defined in Task 4, used in Task 6 ✅
- `onMove: (id: string, folder: string | null) => void` defined in Task 8, threaded in Task 9 ✅
- `backdropHidden?: boolean` and `positionStyle?: React.CSSProperties` defined in Task 10, used in Task 11 ✅
- `Switch` component defined in Task 2, imported in Task 3 ✅
- `previewPositionStyle` uses `right: "1rem"` with `left: "auto"` — consistent with CSS override of Tailwind's `left-1/2` ✅

**Placeholder scan:** No TBDs, no "implement later" — all code is fully written.
