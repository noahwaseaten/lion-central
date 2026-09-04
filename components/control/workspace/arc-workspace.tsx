"use client";

import { IconContext } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { OfflineBanner } from "@/components/control/offline-banner";
import { useAnnouncement } from "@/hooks/use-announcement";
import { useArcConfig } from "@/hooks/use-arc-config";
import { useFeed } from "@/hooks/use-feed";
import { useFeedSettings } from "@/hooks/use-feed-settings";
import { useLastArrival } from "@/hooks/use-last-arrival";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { usePresets } from "@/hooks/use-presets";
import { useRaceClock } from "@/hooks/use-race-clock";
import { type ContentType, defaultContent, type ZoneContent } from "@/lib/arc/content";
import type { NormRect, Selection } from "@/lib/arc/layout-model";
import type { Preset } from "@/lib/arc/presets";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import type { SurfaceId } from "@/lib/arc/surfaces";

import { ArcStage } from "./arc-stage";
import { LayersPanel } from "./layers-panel";
import { TopToolbar } from "./top-toolbar";
import { ZoneInspector } from "./zone-inspector";

/** Nudge a pasted component's rect so it doesn't land exactly on top of the copy. */
function offsetRect(r: NormRect): NormRect {
  const off = 0.03;
  return { ...r, x: Math.min(1 - r.w, r.x + off), y: Math.min(1 - r.h, r.y + off) };
}

/**
 * The unified 2D Arc Control workspace: a toolbar, a layers rail, the interactive
 * free-canvas stage, and a contextual inspector — all driving the shared layout
 * the `/output/*` screens render.
 */
export function ArcWorkspace() {
  const {
    config,
    isDirty,
    publish,
    setBackground,
    setSurfaceSize,
    replaceConfig,
    addComponent,
    removeComponent,
    setComponentContent,
    setComponentRect,
    renameComponent,
    reorderComponent,
    setSurfaceOrder,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useArcConfig("draft");
  const { custom, save, update: updatePreset, remove } = usePresets();
  // The preset (if any) currently applied to the draft — tracked so "Update"
  // can re-save it in place without the operator retyping its name.
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const { settings, update } = useFeedSettings();
  const online = useOnlineStatus();
  const { entries, status } = useFeed({
    file: settings.file,
    thresholds: settings.thresholds,
    pollingMs: settings.pollingMs,
    useFallbackAlways: settings.useFallbackAlways,
    online,
  });
  const { elapsed, running, mode, direction, start, pause, reset, setElapsedMs, startCountdown } = useRaceClock();
  const { lastArrivalMs, lastArrivalSplit } = useLastArrival(entries);
  const {
    announcement,
    send: sendAnnouncement,
    extend: extendAnnouncement,
    cancel: cancelAnnouncement,
  } = useAnnouncement();

  const [selected, setSelected] = useState<Selection | null>(null);

  // Keyboard shortcuts read the latest selection/config/clipboard via refs so the
  // single document listener never needs to be torn down and re-added.
  const announcementRef = useRef(announcement);
  const cancelRef = useRef(cancelAnnouncement);
  const selectedRef = useRef(selected);
  const configRef = useRef(config);
  const clipboardRef = useRef<{ content: ZoneContent; rect: NormRect } | null>(null);
  useEffect(() => {
    announcementRef.current = announcement;
    cancelRef.current = cancelAnnouncement;
    selectedRef.current = selected;
    configRef.current = config;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Works on both Windows/Linux (Ctrl) and Mac (Cmd).
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase(); // Shift turns e.key upper-case (e.g. "Z")

      // Ctrl/Cmd+Z cancels an active announcement, regardless of focus.
      if (key === "z" && !e.shiftKey && announcementRef.current) {
        e.preventDefault();
        cancelRef.current();
        return;
      }

      // Let native text-field undo/copy/cut/paste run inside inputs and editable text.
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditable) return;

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      const sel = selectedRef.current;
      const comp = sel?.id ? configRef.current.surfaces[sel.surface]?.find((c) => c.id === sel.id) : null;

      if (key === "c" && comp) {
        e.preventDefault();
        clipboardRef.current = structuredClone({ content: comp.content, rect: comp.rect });
        return;
      }
      if (key === "x" && comp && sel) {
        e.preventDefault();
        clipboardRef.current = structuredClone({ content: comp.content, rect: comp.rect });
        removeComponent(sel.surface, comp.id);
        setSelected(null);
        return;
      }
      if (key === "v" && sel && clipboardRef.current) {
        e.preventDefault();
        const clip = structuredClone(clipboardRef.current);
        const id = addComponent(sel.surface, clip.content, offsetRect(clip.rect));
        setSelected({ surface: sel.surface, id });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, addComponent, removeComponent]);

  // Add a component of `type` to a surface and select it.
  const addAndSelect = useCallback(
    (surface: SurfaceId, type: ContentType) => {
      const id = addComponent(surface, defaultContent(type));
      setSelected({ surface, id });
    },
    [addComponent],
  );

  // Clone an existing component onto the same surface, offset so it doesn't land
  // exactly on top of the original, and select the copy. Backs both the layers
  // panel's "Duplicate" row action and Ctrl/Cmd+C-then-V.
  const duplicateComponent = useCallback(
    (surface: SurfaceId, id: string) => {
      const comp = config.surfaces[surface]?.find((c) => c.id === id);
      if (!comp) return;
      const clone = structuredClone({ content: comp.content, rect: comp.rect });
      const newId = addComponent(surface, clone.content, offsetRect(clone.rect));
      setSelected({ surface, id: newId });
    },
    [config, addComponent],
  );

  const inputs: SurfaceInputs = {
    config,
    feed: { entries, status, lastArrivalMs, lastArrivalSplit },
    clock: { ms: elapsed, running, direction },
    announcement,
  };

  return (
    <IconContext.Provider value={{ weight: "regular", size: 16 }}>
      <div className="dark flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <TopToolbar
          config={config}
          setBackground={setBackground}
          feedSettings={settings}
          feedStatus={status}
          clock={{ elapsed, running, mode, start, pause, reset }}
          onPublish={publish}
          isDirty={isDirty}
          history={{ undo, redo, canUndo, canRedo }}
          announcementControls={{
            announcement,
            send: sendAnnouncement,
            extend: extendAnnouncement,
            cancel: cancelAnnouncement,
          }}
          presets={{
            custom,
            activePresetId,
            onApply: (preset: Preset) => {
              replaceConfig(preset.config);
              setSelected(null);
              setActivePresetId(preset.id);
            },
            onSave: (name) => setActivePresetId(save(name, config)),
            onUpdate: (id) => updatePreset(id, config),
            onDelete: (id) => {
              remove(id);
              setActivePresetId((current) => (current === id ? null : current));
            },
          }}
        />

        {!online && (
          <div className="border-b border-border px-3 py-2">
            <OfflineBanner />
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:block">
            <LayersPanel
              config={config}
              selected={selected}
              onSelect={setSelected}
              addComponent={addAndSelect}
              duplicateComponent={duplicateComponent}
              removeComponent={(surface, id) => {
                removeComponent(surface, id);
                setSelected((s) => (s?.id === id ? null : s));
              }}
              renameComponent={renameComponent}
              setSurfaceOrder={setSurfaceOrder}
            />
          </aside>

          <ArcStage
            config={config}
            inputs={inputs}
            selected={selected}
            onSelect={setSelected}
            setComponentRect={setComponentRect}
            addComponent={addAndSelect}
            removeComponent={removeComponent}
            setSurfaceSize={setSurfaceSize}
          />

          <aside className="w-80 shrink-0 border-l border-border bg-card">
            <ZoneInspector
              selected={selected}
              config={config}
              setComponentContent={setComponentContent}
              setComponentRect={setComponentRect}
              renameComponent={renameComponent}
              reorderComponent={reorderComponent}
              feedSettings={settings}
              updateFeed={update}
              feedStatus={status}
              clock={{ elapsed, running, mode, start, pause, reset, setElapsedMs, startCountdown }}
            />
          </aside>
        </div>
      </div>
    </IconContext.Provider>
  );
}
