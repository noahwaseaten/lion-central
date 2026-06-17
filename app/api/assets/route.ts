import { NextResponse } from "next/server";

import { listAssets, saveDataUrl } from "@/lib/arc/assets-store";

export const dynamic = "force-dynamic";

/** GET → the logo library (newest first). */
export async function GET() {
  return NextResponse.json({ assets: await listAssets() });
}

/**
 * POST { name, dataUrl } → store an uploaded logo and return its `{ id, name, url }`.
 * The url is stable and served by `/api/assets/<id>`, so it persists across tabs
 * and any device hitting this server.
 */
export async function POST(request: Request) {
  let body: { name?: unknown; dataUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, dataUrl } = body;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Expected an image data URL" }, { status: 400 });
  }

  try {
    const asset = await saveDataUrl(dataUrl, typeof name === "string" ? name : "logo");
    return NextResponse.json({ asset });
  } catch {
    return NextResponse.json({ error: "Could not save the logo" }, { status: 500 });
  }
}
