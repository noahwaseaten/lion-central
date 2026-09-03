import type { AssetInfo } from "@/lib/arc/assets-shared";

/** `null` = every asset, `""` = unfiled, otherwise a folder name. */
export type FolderFilter = string | null;

export interface FolderCounts {
  all: number;
  unfiled: number;
  byFolder: Record<string, number>;
}

/**
 * Which folder an asset belongs to for display purposes.
 *
 * `assetFolders` can name a folder that no longer exists — deleted in another
 * tab, or while this one held a stale list. Those assets read as unfiled, so
 * they stay reachable instead of disappearing into a folder nobody can select.
 */
function folderOf(
  assetId: string,
  assetFolders: Record<string, string>,
  known: Set<string>,
): string | null {
  const folder = assetFolders[assetId];
  return folder && known.has(folder) ? folder : null;
}

/**
 * How many assets sit in each folder, so the rail can say so without the
 * operator clicking through every folder to find out.
 */
export function folderCounts(
  assets: AssetInfo[],
  assetFolders: Record<string, string>,
  folders: string[],
): FolderCounts {
  const known = new Set(folders);
  const byFolder: Record<string, number> = {};
  for (const name of folders) byFolder[name] = 0;

  let unfiled = 0;
  for (const asset of assets) {
    const folder = folderOf(asset.id, assetFolders, known);
    if (folder) byFolder[folder] += 1;
    else unfiled += 1;
  }

  return { all: assets.length, unfiled, byFolder };
}

/** The assets the grid should show. Shares `folderOf` with the counts, so the two never disagree. */
export function filterAssets(
  assets: AssetInfo[],
  assetFolders: Record<string, string>,
  folders: string[],
  active: FolderFilter,
  search: string,
): AssetInfo[] {
  const known = new Set(folders);
  const query = search.trim().toLowerCase();

  return assets.filter((asset) => {
    if (active !== null) {
      const folder = folderOf(asset.id, assetFolders, known);
      if (active === "" ? folder !== null : folder !== active) return false;
    }
    return !query || asset.name.toLowerCase().includes(query);
  });
}
