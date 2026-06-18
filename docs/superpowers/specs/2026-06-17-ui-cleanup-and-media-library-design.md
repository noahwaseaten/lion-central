# UI Cleanup & Media Library — Design Spec
**Date:** 2026-06-17  
**Status:** Approved

## Overview

Five related improvements: remove broken canvas affordance, strip noisy status text, give every tab a meaningful identity, and replace the flat inline logo grid with a proper folder-based media library modal.

---

## 1. Remove Stage "Add" Chip

The `AddComponentMenu` trigger rendered above each surface in `arc-stage.tsx` (positioned at `top: p.y * view.scale - 22`) is visually broken — it clips under the viewport edge and is unreachable. Remove the entire block. Adding components remains available via the layers panel "+ Add" button.

**Files:** `components/control/workspace/arc-stage.tsx`

---

## 2. Text / Label Cleanup

### Status bar (`components/control/workspace/status-bar.tsx`)

| Before | After |
|---|---|
| `"feed live (push)"` | `"feed live"` |
| `"feed live (polling)"` | `"feed polling"` |
| `"feed connecting"` | `"feed connecting"` (keep) |
| `"feed reconnecting"` | `"feed reconnecting"` (keep) |
| `"feed connected"` | `"no athletes"` (clearer) |
| `"feed unavailable"` | `"no feed"` (keep) |
| `"feed offline"` | `"feed offline"` (keep) |
| Component count span | **remove entirely** |
| `"Autosaved · synced across tabs"` span | **remove entirely** |

Result: the status bar is just online/offline + one feed status pill. Clean.

### Feed settings section (`components/control/feed-settings-section.tsx`)

| Before | After |
|---|---|
| `"Live (push)"` | `"Live"` |
| `"Live (polling)"` | `"Polling"` |

### Zone content editor (`components/control/zone-content-editor.tsx`)

Remove the `<Hint>` paragraph below the "Animated digits (NumberFlow)" toggle. The toggle label is self-explanatory; the explanation about "Race clock" is noise.

---

## 3. Tab Titles & Favicons

### Root layout (`app/layout.tsx`)

Change global metadata title to `"Arc Control · Lion Central"`.

### Output pages (`app/output/[surface]/page.tsx`)

Add `generateMetadata` (async, reads the `surface` param):

```
clock     → "Clock · Output" + 🕐 emoji favicon
topbar    → "Top Bar · Output" + 📺 emoji favicon
leg-left  → "Left Leg · Output" + ◀ emoji favicon
leg-right → "Right Leg · Output" + ▶ emoji favicon
```

Emoji favicons are implemented as inline SVG data URIs in the `icons` metadata field — no new image assets needed.

**Files:** `app/layout.tsx`, `app/output/[surface]/page.tsx`

---

## 4. Media Library (Folder-Based)

### 4.1 Storage model

All assets remain flat files in `ASSETS_DIR`. A `_folders.json` sidecar lives at `ASSETS_DIR/_folders.json`:

```json
{
  "folders": ["Sponsors", "Team Logos", "Misc"],
  "assetFolders": {
    "abc123__logo.png": "Sponsors",
    "def456__team.png": "Team Logos"
  }
}
```

Assets absent from `assetFolders` are implicitly in the root (shown under "All" and "Unfiled"). This is fully backward-compatible — no migration needed.

### 4.2 Server-side changes

**`lib/arc/asset-folders.ts`** (new) — pure functions:
- `readFolderMeta()` → `{ folders: string[], assetFolders: Record<string,string> }`
- `writeFolderMeta(meta)` → void
- `createFolder(name)`, `renameFolder(oldName, newName)`, `deleteFolder(name)` (moves its assets to unfiled)
- `moveAsset(id, folder | null)`

**`lib/arc/assets-store.ts`** — `listAssets()` joins folder metadata into each `AssetInfo` (adds optional `folder?: string` field).

**`app/api/assets/folders/route.ts`** (new):
- `GET /api/assets/folders` → `{ folders: string[], assetFolders: Record<string,string> }`
- `POST /api/assets/folders` body `{ action: "create"|"rename"|"delete"|"move", ... }`

**`app/api/assets/route.ts`** — `POST` (upload) accepts optional `folder` in the request body; assigns the new asset to that folder in `_folders.json`.

### 4.3 Client-side hooks

**`hooks/use-logo-library.ts`** — extend with:
- `folders: string[]`
- `createFolder(name)`, `renameFolder(old, next)`, `deleteFolder(name)`
- `moveAsset(id, folder | null)`
- `uploadToFolder(files, folder)` — overload of existing `upload()`

### 4.4 MediaLibrary component

Replace `components/control/logo-library.tsx` with a full `MediaLibrary` component family:

```
components/control/media-library/
  index.tsx          — re-exports MediaLibraryTrigger + MediaLibraryModal
  modal.tsx          — Dialog wrapper, owns open/close state
  folder-sidebar.tsx — folder list: "All", "Unfiled", named folders, + New folder
  asset-grid.tsx     — grid of AssetTile, filtered by active folder
  asset-tile.tsx     — image thumbnail + hover overlay (select check, move menu, delete)
  upload-zone.tsx    — drag-and-drop + click-to-upload, uploads to active folder
```

**Modal layout:**
```
┌──────────────────────────────────────────────────┐
│ Media Library                        [Upload] [✕] │
├──────────┬───────────────────────────────────────┤
│ All      │  [search input]                       │
│ Unfiled  │                                       │
│ Sponsors │  ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│ Logos    │  │   │ │   │ │   │ │   │            │
│          │  └───┘ └───┘ └───┘ └───┘            │
│ + Folder │                                       │
└──────────┴───────────────────────────────────────┘
```

**Asset tile hover:**
- Checkmark to select/deselect (multi-select for sponsors, single for image)
- "Move to…" popover with folder list
- Delete button (confirm inline — no alert dialog)

**Folder sidebar interactions:**
- Click to filter
- Double-click folder name to rename (inline input)
- Trash icon appears on hover (disabled if folder has assets, unless user confirms move-to-unfiled)

### 4.5 Integration into zone-content-editor

Replace inline `<LogoLibrary ... />` usages with:

```tsx
// image case
<MediaLibraryTrigger
  mode="single"
  selected={content.src ? [content.src] : []}
  onPick={(url) => onChange({ ...content, src: url })}
/>

// sponsors case
<MediaLibraryTrigger
  mode="multi"
  selected={srcs}
  onPick={toggle}
/>
```

`MediaLibraryTrigger` renders a compact button showing "Browse library (N selected)" that opens the modal. The inspector no longer hosts the asset grid inline.

---

## Files Changed

| File | Change |
|---|---|
| `components/control/workspace/arc-stage.tsx` | Remove Add chip block |
| `components/control/workspace/status-bar.tsx` | Strip noisy text |
| `components/control/feed-settings-section.tsx` | Strip `(push)`/`(polling)` |
| `components/control/zone-content-editor.tsx` | Remove Hint; swap `LogoLibrary` → `MediaLibraryTrigger` |
| `app/layout.tsx` | Updated title |
| `app/output/[surface]/page.tsx` | Add `generateMetadata` with per-surface title + emoji favicon |
| `lib/arc/assets-store.ts` | Add `folder?` to `AssetInfo`, join folder meta in `listAssets` |
| `lib/arc/asset-folders.ts` | **New** — folder CRUD |
| `app/api/assets/folders/route.ts` | **New** — folder API |
| `app/api/assets/route.ts` | Accept `folder` in upload body |
| `hooks/use-logo-library.ts` | Add folder ops |
| `components/control/logo-library.tsx` | **Delete** (replaced) |
| `components/control/media-library/` | **New** component family |

## Out of Scope

- Drag-and-drop from library onto stage (future)
- Nested folders (single-level only)
- Bulk move/delete (future)
- Search across folders (search input filters names within current folder view)
