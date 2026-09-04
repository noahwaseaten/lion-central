/**
 * Client-side counterpart to `lib/live/store.ts`. One shared SSE connection
 * (with a polling fallback, same shape as `useFeed`) fans out server-pushed
 * state to every subscribing hook, so `use-arc-config`, `use-feed-settings`,
 * `use-race-clock`, and `use-announcement` can all reflect edits made on a
 * different machine instead of only syncing within one browser via
 * `localStorage`'s `storage` event.
 */
export type LiveKey = "arc" | "feedSettings" | "clock" | "announcement";
export type LiveState = Partial<Record<LiveKey, unknown>>;
type Listener = (state: LiveState) => void;

/** Delay before SSE connection trouble escalates to polling. */
const FALLBACK_DELAY_MS = 4000;
const POLL_MS = 2000;

let es: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let cached: LiveState = {};
let haveSnapshot = false;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(cached);
}

function applySnapshot(state: LiveState) {
  cached = state;
  haveSnapshot = true;
  notify();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  if (pollTimer) return;
  const poll = async () => {
    try {
      const res = await fetch("/api/live/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { state: LiveState };
      applySnapshot(data.state);
    } catch {
      // ignore; retry next tick
    }
  };
  void poll();
  pollTimer = setInterval(() => void poll(), POLL_MS);
}

function connect() {
  if (es || typeof window === "undefined") return;
  es = new EventSource("/api/live/stream");
  es.addEventListener("snapshot", (ev) => {
    stopPolling();
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    try {
      applySnapshot(JSON.parse((ev as MessageEvent).data) as LiveState);
    } catch {
      // ignore malformed frame
    }
  });
  es.onerror = () => {
    if (!fallbackTimer) fallbackTimer = setTimeout(startPolling, FALLBACK_DELAY_MS);
  };
}

function disconnect() {
  es?.close();
  es = null;
  stopPolling();
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}

/**
 * Subscribe to live state changes. Opens the shared connection on the first
 * subscriber and tears it down when the last one unsubscribes. Calls back
 * immediately if a snapshot has already been received.
 */
export function subscribeLive(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) connect();
  if (haveSnapshot) listener(cached);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect();
  };
}

/** One-shot fetch of the current state, for a mount-time hydrate that doesn't need an ongoing subscription. */
export async function fetchLiveSnapshot(): Promise<LiveState> {
  if (haveSnapshot) return cached;
  try {
    const res = await fetch("/api/live/state", { cache: "no-store" });
    if (!res.ok) return {};
    const data = (await res.json()) as { state: LiveState };
    return data.state;
  } catch {
    return {};
  }
}

/** Push a key's value to the server; other clients receive it via the live stream. */
export async function pushLive(key: LiveKey, value: unknown): Promise<void> {
  try {
    await fetch("/api/live/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch {
    // best-effort; the next snapshot/poll reconciles
  }
}
