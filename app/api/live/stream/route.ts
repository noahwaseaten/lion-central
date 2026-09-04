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

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

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

      send("snapshot", getLiveState());
      unsubscribe = subscribeLiveState((state) => send("snapshot", state));

      heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
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
