import { NextResponse } from "next/server";

import { FEED_ROWS } from "@/lib/arc/layout";
import { readSnapshot } from "@/lib/feed/tail";

export const dynamic = "force-dynamic";

/** GET ?file= → current snapshot (last N athletes, newest-first). Polling fallback. */
export async function GET(request: Request) {
  const dir = process.env.FEED_DIR;
  if (!dir) {
    return NextResponse.json({ error: "FEED_DIR is not set" }, { status: 404 });
  }

  const file = new URL(request.url).searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "Missing 'file' parameter" }, { status: 400 });
  }

  try {
    const snapshot = await readSnapshot(dir, file, FEED_ROWS);
    return NextResponse.json({ snapshot });
  } catch (err) {
    const escapes = err instanceof Error && err.message.includes("escapes");
    return NextResponse.json(
      { error: escapes ? "Invalid file path" : "Could not read feed file" },
      { status: escapes ? 400 : 500 },
    );
  }
}
