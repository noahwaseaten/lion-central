import { type FSWatcher, watch } from "node:fs";

import { FEED_ROWS } from "@/lib/arc/layout";
import { readSnapshot, safeResolve } from "@/lib/feed/tail";

export const dynamic = "force-dynamic";

/**
 * GET ?file= → Server-Sent Events stream.
 *
 * Emits an idempotent `snapshot` event (the current last-N athletes) on open
 * and on every file change, plus periodic `: ping` heartbeats. Because each
 * snapshot is full state, reconnects and missed events self-heal.
 */
export async function GET(request: Request) {
  const dir = process.env.FEED_DIR;
  if (!dir) return new Response("FEED_DIR is not set", { status: 404 });

  const file = new URL(request.url).searchParams.get("file");
  if (!file) return new Response("Missing 'file' parameter", { status: 400 });

  let filePath: string;
  try {
    filePath = safeResolve(dir, file);
  } catch {
    return new Response("Invalid file path", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let debounce: ReturnType<typeof setTimeout> | null = null;
      let watcher: FSWatcher | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      // A dropped/half-open connection (routine over a flaky tunnel) can make
      // `enqueue` throw; left uncaught inside the heartbeat's setInterval that
      // would crash the whole dev server, so it must always be caught here.
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          cleanup();
        }
      };

      const push = async () => {
        try {
          const snapshot = await readSnapshot(dir, file, FEED_ROWS);
          send("snapshot", snapshot);
        } catch {
          send("feederror", { message: "Feed file unavailable" });
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (debounce) clearTimeout(debounce);
        if (heartbeat) clearInterval(heartbeat);
        watcher?.close();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      void push();

      try {
        watcher = watch(filePath, () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void push(), 80);
        });
        watcher.on("error", () => send("feederror", { message: "Watch error" }));
      } catch {
        send("feederror", { message: "Could not watch feed file" });
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
