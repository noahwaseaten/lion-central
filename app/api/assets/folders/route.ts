import { type NextRequest, NextResponse } from "next/server";

import {
  createFolder,
  deleteFolder,
  moveAsset,
  readFolderMeta,
  renameFolder,
} from "@/lib/arc/asset-folders";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readFolderMeta());
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  switch (action) {
    case "create": {
      const name = body.name;
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "name required" }, { status: 400 });
      }
      await createFolder(name.trim());
      return NextResponse.json({ ok: true });
    }
    case "rename": {
      const { oldName, newName } = body;
      if (typeof oldName !== "string" || typeof newName !== "string") {
        return NextResponse.json({ error: "oldName and newName required" }, { status: 400 });
      }
      await renameFolder(oldName, newName.trim());
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      const name = body.name;
      if (typeof name !== "string") {
        return NextResponse.json({ error: "name required" }, { status: 400 });
      }
      await deleteFolder(name);
      return NextResponse.json({ ok: true });
    }
    case "move": {
      const { id, folder } = body;
      if (typeof id !== "string") {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      await moveAsset(id, typeof folder === "string" ? folder : null);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
