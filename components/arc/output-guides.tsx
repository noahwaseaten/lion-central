"use client";

import { useEffect, useState } from "react";

const KEY = "lion-central.output-guides";

/**
 * A toggle-able registration overlay for an /output surface: a high-contrast border
 * on the exact surface rectangle, corner crop marks, a center crosshair, and a
 * dimension readout — so the media team can center/map the surface onto the arc.
 * Rendered as a DOM overlay (never into the canvas), so it can't leak into the LED
 * feed. Press G to toggle; state persists. Default on.
 */
export function OutputGuides({ label, w, h }: { label: string; w: number; h: number }) {
  const [on, setOn] = useState(true);
  const [idle, setIdle] = useState(false);

  // Restore persisted on/off once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted toggle once on mount
      if (saved !== null) setOn(saved === "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  // G toggles; persist the choice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "g") return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      setOn((v) => {
        const next = !v;
        try {
          localStorage.setItem(KEY, next ? "1" : "0");
        } catch {
          // ignore
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-hide the corner button when the mouse is idle.
  useEffect(() => {
    let t = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener("pointermove", wake);
    wake();
    return () => {
      window.removeEventListener("pointermove", wake);
      window.clearTimeout(t);
    };
  }, []);

  const C = "#ff2d95";

  return (
    <>
      {/* guides overlay — stays clipped to the surface rectangle */}
      <div className="pointer-events-none absolute inset-0">
        {on && (
          <>
            {/* exact-rectangle border */}
            <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 2px ${C}` }} />
            {/* center crosshair */}
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ background: C, opacity: 0.5 }} />
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: C, opacity: 0.5 }} />
            {/* corner crop marks */}
            {(["tl", "tr", "bl", "br"] as const).map((c) => (
              <div
                key={c}
                className="absolute"
                style={{
                  width: 18,
                  height: 18,
                  [c.includes("l") ? "left" : "right"]: -1,
                  [c.includes("t") ? "top" : "bottom"]: -1,
                  borderTop: c.includes("t") ? `3px solid ${C}` : undefined,
                  borderBottom: c.includes("b") ? `3px solid ${C}` : undefined,
                  borderLeft: c.includes("l") ? `3px solid ${C}` : undefined,
                  borderRight: c.includes("r") ? `3px solid ${C}` : undefined,
                }}
              />
            ))}
            {/* dimension readout */}
            <div
              className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-xs font-bold"
              style={{ color: "#fff", background: C }}
            >
              {label} · {w}×{h}
            </div>
          </>
        )}
      </div>
      {/* toggle button — fixed to viewport so it sits outside the surface rectangle */}
      <button
        type="button"
        onClick={() => {
          setOn((v) => {
            const next = !v;
            try {
              localStorage.setItem(KEY, next ? "1" : "0");
            } catch {
              // ignore
            }
            return next;
          });
        }}
        className="fixed left-2 top-2 rounded-md border border-white/30 bg-black/60 px-2 py-1 text-xs font-medium text-white outline-none transition-opacity hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white"
        style={{ opacity: idle ? 1 : 0 }}
        aria-label={on ? "Hide alignment guides (G)" : "Show alignment guides (G)"}
      >
        {on ? "Guides on (G)" : "Guides off (G)"}
      </button>
    </>
  );
}
