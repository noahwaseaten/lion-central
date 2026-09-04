/**
 * Server-side live-session broadcaster (LOCAL ONLY), in-memory for the life of
 * the dev server process. Mirrors `feed/stream`'s SSE pattern but for
 * operator-driven state (arc config, feed settings, clock, announcement) so a
 * remote machine — a tunneled PC, an OBS browser source — reflects edits made
 * on the host instead of starting from its own blank `localStorage`.
 */
export type LiveKey = "arc" | "feedSettings" | "clock" | "announcement";
export type LiveState = Partial<Record<LiveKey, unknown>>;

export const LIVE_KEYS: LiveKey[] = ["arc", "feedSettings", "clock", "announcement"];

const listeners = new Set<(state: LiveState) => void>();
let state: LiveState = {};

export function getLiveState(): LiveState {
  return state;
}

export function setLiveValue(key: LiveKey, value: unknown): LiveState {
  state = { ...state, [key]: value };
  // Dispatched to every SSE connection (one process-wide fan-out), so one
  // listener throwing — e.g. a dropped tunnel connection failing to enqueue —
  // must never stop the others from being notified.
  for (const listener of listeners) {
    try {
      listener(state);
    } catch {
      // that connection's own cleanup handles unsubscribing itself
    }
  }
  return state;
}

/** Returns an unsubscribe function. */
export function subscribeLiveState(cb: (state: LiveState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
