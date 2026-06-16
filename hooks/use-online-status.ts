"use client";

import { useEffect, useState } from "react";

/**
 * Tracks `navigator.onLine`. Informational only — the feed itself is local, so
 * losing internet does not stop it (see SPEC §8).
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
