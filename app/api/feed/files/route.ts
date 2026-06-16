import { NextResponse } from "next/server";

import { listTxtFiles } from "@/lib/feed/tail";

export const dynamic = "force-dynamic";

/** GET → list the `.txt` feed files in FEED_DIR, newest first. */
export async function GET() {
  const dir = process.env.FEED_DIR;
  if (!dir) {
    // Feature is local-only; an unset FEED_DIR means "disabled" (e.g. deployed).
    return NextResponse.json({ error: "FEED_DIR is not set" }, { status: 404 });
  }
  try {
    const files = await listTxtFiles(dir);
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json(
      { error: "FEED_DIR is set but could not be read" },
      { status: 500 },
    );
  }
}
