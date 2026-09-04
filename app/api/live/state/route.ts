import { NextResponse } from "next/server";

import { getLiveState, LIVE_KEYS, type LiveKey, setLiveValue } from "@/lib/live/store";

export const dynamic = "force-dynamic";

/** GET → the current live session state (arc config, feed settings, clock, announcement). */
export async function GET() {
  return NextResponse.json({ state: getLiveState() });
}

/** POST { key, value } → set one key of the live session state; broadcasts to every listener. */
export async function POST(request: Request) {
  let body: { key?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.key !== "string" || !LIVE_KEYS.includes(body.key as LiveKey)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const state = setLiveValue(body.key as LiveKey, body.value);
  return NextResponse.json({ state });
}
