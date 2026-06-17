import { NextResponse } from "next/server";

import { contentTypeFor, deleteAsset, isValidAssetId, readAsset } from "@/lib/arc/assets-store";

export const dynamic = "force-dynamic";

/** GET → the stored logo's bytes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidAssetId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const bytes = await readAsset(id);
  if (!bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const type = contentTypeFor(id);
  const isSvg = type === "image/svg+xml";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    // Neutralize stored-XSS: even on direct navigation the asset can't run scripts.
    // (Embedding via <img>/canvas never executes SVG scripts regardless.)
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    // Belt-and-braces for SVG: hand it back as a download rather than a rendered doc.
    ...(isSvg ? { "Content-Disposition": "attachment" } : {}),
  };

  return new NextResponse(new Uint8Array(bytes), { headers });
}

/** DELETE → remove the logo from the library. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidAssetId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await deleteAsset(id);
  return NextResponse.json({ ok: true });
}
