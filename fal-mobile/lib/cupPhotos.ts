import * as FileSystem from 'expo-file-system/legacy';

const MAX_PHOTOS = 20;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function root(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cup-photos/` : null;
}

async function cleanupCupPhotos(dir: string, keepUri: string) {
  const now = Date.now();
  const names = await FileSystem.readDirectoryAsync(dir);
  const infos = await Promise.all(names.map(async (name) => {
    const uri = `${dir}${name}`;
    const info = await FileSystem.getInfoAsync(uri);
    return { uri, modified: info.exists && info.modificationTime ? info.modificationTime * 1000 : 0 };
  }));

  infos.sort((a, b) => b.modified - a.modified);
  await Promise.all(infos.map(async (item, index) => {
    if (item.uri === keepUri) return;
    if (index >= MAX_PHOTOS || !item.modified || now - item.modified > MAX_AGE_MS) {
      await FileSystem.deleteAsync(item.uri, { idempotent: true });
    }
  }));
}

export async function cleanupStoredCupPhotos(): Promise<void> {
  const dir = root();
  if (!dir) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return;
  await cleanupCupPhotos(dir, '');
}

export async function deleteAllCupPhotos(): Promise<void> {
  const dir = root();
  if (dir) await FileSystem.deleteAsync(dir, { idempotent: true });
}

export async function existingCupPhotos(
  photos: Record<string, string>,
): Promise<Record<string, string>> {
  const entries = await Promise.all(Object.entries(photos).map(async ([id, uri]) => {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? ([id, uri] as const) : null;
  }));
  return Object.fromEntries(entries.filter((x): x is readonly [string, string] => x !== null));
}

/** Kamera önbelleğindeki fincanı uygulama alanında en fazla 20 kayıt/30 gün tutar. */
export async function persistCupPhoto(readingId: string, sourceUri: string): Promise<string> {
  const dir = root();
  if (!dir) return sourceUri;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const safeId = readingId.replace(/[^a-zA-Z0-9_-]/g, '');
    const target = `${dir}${safeId}.jpg`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.copyAsync({ from: sourceUri, to: target });
    cleanupCupPhotos(dir, target).catch(() => {});
    return target;
  } catch {
    return sourceUri;
  }
}
