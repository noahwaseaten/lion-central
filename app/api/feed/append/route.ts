import { NextResponse } from "next/server";

import { randomAthleteLine } from "@/lib/feed/random";
import { appendLine } from "@/lib/feed/tail";

export const dynamic = "force-dynamic";

/**
 * POST ?file= → append one random athlete line to the feed file (LOCAL ONLY).
 *
 * Lets the operator preview the live-feed animation without the timing backend.
 * Returns the line that was written.
 */
export async function POST(request: Request) {
  const dir = process.env.FEED_DIR;
  if (!dir) {
    return NextResponse.json({ error: "FEED_DIR is not set" }, { status: 404 });
  }

  const file = new URL(request.url).searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "Missing 'file' parameter" }, { status: 400 });
  }

  try {
    const line = randomAthleteLine();
    await appendLine(dir, file, line);
    return NextResponse.json({ line });
  } catch (err) {
    const escapes = err instanceof Error && err.message.includes("escapes");
    return NextResponse.json(
      { error: escapes ? "Invalid file path" : "Could not write to feed file" },
      { status: escapes ? 400 : 500 },
    );
  }
}
