# UI Polish, Media Library Enhancements & Logo Preview Mode — Design Spec
**Date:** 2026-06-18  
**Status:** Approved

## Overview

Three related improvements: (1) fix UI inconsistencies and non-shadcn components, (2) make the media library more capable with drag-to-folder and full video support, and (3) add a "preview mode" to the media library modal so operators can see the arc live after placing a logo.

---

## 1. UI Consistency Fixes

### 1a. Appearance Popover Hex Overflow

**File:** `components/control/workspace/appearance-popover.tsx`

The hex text input inside the `w-60` popover can overflow visually. Fix:
- Add `min-w-0` to the hex input so flex shrinking works correctly
- Add `maxLength={7}` to prevent values longer than a hex color from being typed
- Constrain the color swatch to `h-8 w-10` for visual consistency

### 1b. Switch Component (replaces raw checkbox)

**New file:** `components/ui/switch.tsx`

Create a `Switch` primitive using `@base-ui-react/switch`, following the same pattern as `dialog.tsx` and `popover.tsx`. API:

```tsx
<Switch checked={value} onCheckedChange={onChange} label="Animated digits" />
```

The switch renders a pill-shaped track (`bg-input → bg-primary` when checked) with a white thumb. Matches the project's dark theme.

**Updated file:** `components/control/zone-content-editor.tsx`

Replace the `Toggle` helper function (which wraps `<input type="checkbox">`) and all three call sites with `Switch`:
- "Animated digits (NumberFlow)" in clock content
- "Loop" in video content  
- "Muted" in video content

The `Toggle` function is removed entirely.

### 1c. Raw `<select>` elements

The selects in `zone-content-editor.tsx` (sponsor mode, columns, video fit) are already styled with `inputCls` matching the design system. No change — Base UI Select adds significant complexity for marginal visual gain.

---

## 2. Media Library Enhancements

### 2a. Drag-to-Folder (HTML5 Drag API)

**File:** `components/control/media-library/asset-tile.tsx`

- Add `draggable` attribute to the outer wrapper div
- `onDragStart`: `event.dataTransfer.setData("assetId", asset.id)` + `event.dataTransfer.effectAllowed = "move"`
- Add `dragover` opacity styling: the tile wrapper dims to `opacity-50` while being dragged (`dragging` state via `onDragStart`/`onDragEnd`)

**File:** `components/control/media-library/folder-sidebar.tsx`

- Each folder button (including "Unfiled") becomes a drop target:
  - `onDragOver`: `event.preventDefault()` + `event.dataTransfer.dropEffect = "move"` + set `dragOver` state
  - `onDrop`: read `event.dataTransfer.getData("assetId")`, call `onMove(id, folder)`, clear `dragOver`
  - `onDragLeave`: clear `dragOver`
- Active drop target gets `ring-1 ring-amber-400` highlight (amber matches the `signal` color token)
- "All" does not accept drops (moving to "All" is meaningless)
- "Unfiled" drops call `onMove(id, null)`

`FolderSidebar` gains `onMove: (id: string, folder: string | null) => void` prop.

**File:** `components/control/media-library/modal.tsx`

Thread `moveAsset` down to `FolderSidebar` as the `onMove` prop.

### 2b. Video Support

**File:** `lib/arc/assets-store.ts`

Add video MIME types to `CONTENT_TYPES` and `EXT_FROM_MIME`:

```ts
".mp4": "video/mp4",
".webm": "video/webm",
".mov": "video/quicktime",
```

Add a helper:
```ts
export function isVideoAsset(id: string): boolean {
  const ext = path.extname(id).toLowerCase();
  return [".mp4", ".webm", ".mov"].includes(ext);
}
```

**File:** `components/control/media-library/upload-zone.tsx`

Change the `accept` attribute on the file input from `image/*` to `image/*,video/*`.

**File:** `components/control/media-library/asset-tile.tsx`

Add a `VideoThumbnail` subcomponent. When `isVideoAsset(asset.id)` is true, render `VideoThumbnail` instead of `<img>`:

```tsx
function VideoThumbnail({ url }: { url: string }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.muted = true;
    video.src = url;
    video.onloadedmetadata = () => { video.currentTime = 0.1; };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      canvas.getContext("2d")!.drawImage(video, 0, 0, 160, 90);
      setThumb(canvas.toDataURL("image/jpeg", 0.8));
      video.src = "";
    };
    return () => { video.src = ""; };
  }, [url]);

  return (
    <div className="relative grid h-full w-full place-items-center">
      {thumb ? (
        <img src={thumb} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="size-6 text-muted-foreground animate-pulse" />
      )}
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <Play weight="fill" className="size-4 text-white drop-shadow" />
      </span>
    </div>
  );
}
```

No external library required — the browser canvas API is sufficient.

---

## 3. Preview Mode — Modal Docks to Right on Logo Pick

### 3a. Behavior

When the user clicks a logo tile in the media library (fires `onPick`):
1. The logo is applied to the arc (existing behavior, unchanged)
2. The modal transitions to **preview mode**:
   - Backdrop fades to fully transparent and becomes `pointer-events-none` (arc stage is clickable)
   - The popup slides from centered to a right-docked panel (right side of viewport, under the toolbar)
   - No countdown or timer text is shown
3. A 15-second inactivity timer starts. Each subsequent `onPick` resets it.
4. After 15 seconds with no new pick, the popup slides back to center and the backdrop restores.

### 3b. Dialog changes

**File:** `components/ui/dialog.tsx`

Extend `DialogPopup` with two optional props:
- `backdropHidden?: boolean` — when true, backdrop is `bg-transparent pointer-events-none` (no blur, no dimming)
- `positionStyle?: React.CSSProperties` — when provided, the popup uses these inline styles instead of the centered Tailwind classes

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

`DialogBackdrop` gains a `hidden` prop:
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

### 3c. MediaLibraryModal changes

**File:** `components/control/media-library/modal.tsx`

Add `previewActive` state and a 15s timer ref:

```tsx
const [previewActive, setPreviewActive] = useState(false);
const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const handlePick = (url: string) => {
  onPick(url);
  if (mode === "single") {
    // Enter preview mode instead of closing
    setPreviewActive(true);
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      setPreviewActive(false);
    }, 15_000);
  }
};

// Cleanup on unmount
useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);
```

In multi mode (sponsors), picking a logo does not trigger preview mode — the user is assembling a set and doesn't need the arc preview after each pick.

Compute the docked position using `window.innerWidth` (safe — this only runs client-side in the dialog):

```tsx
const PREVIEW_WIDTH = 340;
const TOOLBAR_HEIGHT = 48;
const PREVIEW_MARGIN = 16;

const previewPositionStyle: React.CSSProperties = previewActive
  ? {
      left: `${window.innerWidth - PREVIEW_WIDTH - PREVIEW_MARGIN}px`,
      top: `${TOOLBAR_HEIGHT + PREVIEW_MARGIN}px`,
      width: `${PREVIEW_WIDTH}px`,
      height: `calc(100dvh - ${TOOLBAR_HEIGHT + PREVIEW_MARGIN * 2}px)`,
      transform: "none",
    }
  : undefined;
```

Pass these to `DialogPopup`:
```tsx
<DialogPopup
  className="flex flex-col overflow-hidden"
  backdropHidden={previewActive}
  positionStyle={previewPositionStyle}
>
```

The `h-[80vh] w-[min(900px,90vw)]` size class is removed from `DialogPopup` and instead lives as the default size (applied only when `!positionStyle`).

---

## Files Changed

| File | Change |
|---|---|
| `components/ui/switch.tsx` | **New** — Switch primitive via `@base-ui-react/switch` |
| `components/ui/dialog.tsx` | Add `backdropHidden` + `positionStyle` props to `DialogPopup`; `hidden` prop to `DialogBackdrop` |
| `components/control/workspace/appearance-popover.tsx` | Fix hex input overflow (`min-w-0`, `maxLength={7}`) |
| `components/control/zone-content-editor.tsx` | Replace `Toggle` + raw checkbox with `Switch` |
| `lib/arc/assets-store.ts` | Add video MIME types + `isVideoAsset()` helper |
| `components/control/media-library/asset-tile.tsx` | Add `draggable`, drag events, `VideoThumbnail` subcomponent |
| `components/control/media-library/folder-sidebar.tsx` | Add drop target logic + `onMove` prop |
| `components/control/media-library/modal.tsx` | Thread `onMove` to sidebar; add preview mode state + 15s timer; pass `backdropHidden`/`positionStyle` to `DialogPopup` |
| `components/control/media-library/upload-zone.tsx` | Accept `video/*` in file input |

## Out of Scope

- Preview mode in multi-select (sponsors) — too disruptive to the multi-pick flow
- Touch/mobile drag (desktop-only internal tool)
- Nested folders
- Server-side video thumbnailing
- Video playback in the asset tile
