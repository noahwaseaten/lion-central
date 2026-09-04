import { getLiveState, subscribeLiveState } from "@/lib/live/store";

export const dynamic = "force-dynamic";

/**
 * GET → Server-Sent Events stream of the live session state.
 *
 * Emits an idempotent `snapshot` event (the full state) on open and on every
 * change, plus periodic `: ping` heartbeats — same shape as `feed/stream`, so
 * reconnects and missed events self-heal.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // A dropped/half-open connection (routine over a flaky tunnel) can make
      // `enqueue` throw. This broadcasts to every subscriber from one shared
      // emitter, so one dead connection throwing here must never propagate —
      // it would both skip every listener queued after it in that emit and,
      // from inside the heartbeat's setInterval, crash the whole dev server.
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send("snapshot", getLiveState());
      if (!closed) {
        unsubscribe = subscribeLiveState((state) => send("snapshot", state));
      }

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15_000);

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
