import { NextResponse } from "next/server";

import { readPresets, writePresets } from "@/lib/arc/presets-store";

export const dynamic = "force-dynamic";

/** GET → the saved layouts (presets), shared across every clone via the repo. */
export async function GET() {
  return NextResponse.json({ presets: await readPresets() });
}

/** PUT { presets } → replace the saved layouts in one shot; returns the stored list. */
export async function PUT(request: Request) {
  let body: { presets?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const presets = await writePresets(body.presets);
    return NextResponse.json({ presets });
  } catch {
    return NextResponse.json({ error: "Could not save presets" }, { status: 500 });
  }
}
