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
import { type ContentType, defaultContent } from "@/lib/arc/content";
import type { Selection } from "@/lib/arc/layout-model";
import type { SurfaceInputs } from "@/lib/arc/render/inputs";
import type { SurfaceId } from "@/lib/arc/surfaces";

import { ArcStage } from "./arc-stage";
import { LayersPanel } from "./layers-panel";
import { TopToolbar } from "./top-toolbar";
import { ZoneInspector } from "./zone-inspector";

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
    replaceConfig,
    addComponent,
    removeComponent,
    setComponentContent,
    setComponentRect,
    renameComponent,
    reorderComponent,
  } = useArcConfig("draft");
  const { builtins, custom, save, remove } = usePresets();
  const { settings, update } = useFeedSettings();
  const online = useOnlineStatus();
  const { entries, status } = useFeed({
    file: settings.file,
    thresholds: settings.thresholds,
    pollingMs: settings.pollingMs,
    useFallbackAlways: settings.useFallbackAlways,
    online,
  });
  const { elapsed, running, start, pause, reset, setElapsedMs } = useRaceClock();
  const { lastArrivalMs, lastArrivalSplit } = useLastArrival(entries);
  const { announcement, send: sendAnnouncement, cancel: cancelAnnouncement } = useAnnouncement();

  // Ctrl/Cmd+Z cancels an active announcement.
  const announcementRef = useRef(announcement);
  const cancelRef = useRef(cancelAnnouncement);
  announcementRef.current = announcement;
  cancelRef.current = cancelAnnouncement;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && announcementRef.current) {
        e.preventDefault();
        cancelRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const [selected, setSelected] = useState<Selection | null>(null);

  // Add a component of `type` to a surface and select it.
  const addAndSelect = useCallback(
    (surface: SurfaceId, type: ContentType) => {
      const id = addComponent(surface, defaultContent(type));
      setSelected({ surface, id });
    },
    [addComponent],
  );

  const inputs: SurfaceInputs = {
    config,
    feed: { entries, status, lastArrivalMs, lastArrivalSplit },
    clock: { ms: elapsed, running },
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
          clock={{ elapsed, running, start, pause, reset }}
          onPublish={publish}
          isDirty={isDirty}
          announcementControls={{
            announcement,
            send: sendAnnouncement,
            cancel: cancelAnnouncement,
          }}
          presets={{
            builtins,
            custom,
            onApply: (c) => {
              replaceConfig(c);
              setSelected(null);
            },
            onSave: (name) => save(name, config),
            onDelete: remove,
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
              removeComponent={(surface, id) => {
                removeComponent(surface, id);
                setSelected((s) => (s?.id === id ? null : s));
              }}
              reorderComponent={reorderComponent}
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
              clock={{ elapsed, running, start, pause, reset, setElapsedMs }}
            />
          </aside>
        </div>
      </div>
    </IconContext.Provider>
  );
}
