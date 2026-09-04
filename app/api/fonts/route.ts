import { NextResponse } from "next/server";

import { listFonts, saveFontDataUrl } from "@/lib/arc/fonts-store";

export const dynamic = "force-dynamic";

/** GET → the custom font library (newest first). */
export async function GET() {
  return NextResponse.json({ fonts: await listFonts() });
}

/**
 * POST { name, family, dataUrl } → store an uploaded font file and return its
 * `{ id, name, family, url }`. The url is stable and served by
 * `/api/fonts/<id>`, so it persists across tabs and any device hitting this
 * server.
 */
export async function POST(request: Request) {
  let body: { name?: unknown; family?: unknown; dataUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, family, dataUrl } = body;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "Expected a font file data URL" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "A filename is required" }, { status: 400 });
  }
  if (typeof family !== "string" || !family.trim()) {
    return NextResponse.json({ error: "A font-family name is required" }, { status: 400 });
  }

  try {
    const font = await saveFontDataUrl(dataUrl, name, family.trim());
    return NextResponse.json({ font });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the font";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
