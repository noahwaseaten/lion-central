import { promises as fs } from "node:fs";
import path from "node:path";

function assetsDir(): string {
  return process.env.ASSETS_DIR ?? path.join(process.cwd(), ".lion-assets");
}

function metaPath(): string {
  return path.join(assetsDir(), "_folders.json");
}

export interface FolderMeta {
  folders: string[];
  assetFolders: Record<string, string>;
}

export async function readFolderMeta(): Promise<FolderMeta> {
  try {
    const raw = await fs.readFile(metaPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "folders" in parsed &&
      "assetFolders" in parsed &&
      Array.isArray((parsed as FolderMeta).folders) &&
      typeof (parsed as FolderMeta).assetFolders === "object"
    ) {
      return parsed as FolderMeta;
    }
  } catch {
    // file missing or corrupt — return empty
  }
  return { folders: [], assetFolders: {} };
}

async function writeFolderMeta(meta: FolderMeta): Promise<void> {
  await fs.mkdir(assetsDir(), { recursive: true });
  await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2));
}

export async function createFolder(name: string): Promise<void> {
  const meta = await readFolderMeta();
  if (meta.folders.includes(name)) return;
  meta.folders.push(name);
  await writeFolderMeta(meta);
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  const meta = await readFolderMeta();
  const idx = meta.folders.indexOf(oldName);
  if (idx < 0) return;
  meta.folders[idx] = newName;
  for (const id of Object.keys(meta.assetFolders)) {
    if (meta.assetFolders[id] === oldName) meta.assetFolders[id] = newName;
  }
  await writeFolderMeta(meta);
}

export async function deleteFolder(name: string): Promise<void> {
  const meta = await readFolderMeta();
  meta.folders = meta.folders.filter((f) => f !== name);
  for (const id of Object.keys(meta.assetFolders)) {
    if (meta.assetFolders[id] === name) delete meta.assetFolders[id];
  }
  await writeFolderMeta(meta);
}

export async function moveAsset(id: string, folder: string | null): Promise<void> {
  const meta = await readFolderMeta();
  if (folder === null) {
    delete meta.assetFolders[id];
  } else {
    meta.assetFolders[id] = folder;
  }
  await writeFolderMeta(meta);
}
