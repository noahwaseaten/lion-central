import { NextResponse } from "next/server";

import { deleteFont, fontContentTypeFor, isValidFontId, readFont } from "@/lib/arc/fonts-store";

export const dynamic = "force-dynamic";

/** GET → the stored font file's bytes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidFontId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const bytes = await readFont(id);
  if (!bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": fontContentTypeFor(id),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** DELETE → remove the font from the library. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidFontId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await deleteFont(id);
  return NextResponse.json({ ok: true });
}
