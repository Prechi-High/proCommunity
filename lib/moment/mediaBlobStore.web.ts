/**
 * Durable media for web: blob: URLs die on reload / revoke.
 * We keep the File/Blob in IndexedDB and play via a fresh object URL.
 */
export const MEDIA_STORE_PREFIX = "unmask-media:";

const DB_NAME = "unmask-media-v1";
const STORE = "blobs";

const objectUrlCache = new Map<string, string>();

export function isMediaStoreUri(uri: string | undefined | null): boolean {
  return Boolean(uri && uri.startsWith(MEDIA_STORE_PREFIX));
}

function storeId(uri: string): string | null {
  return isMediaStoreUri(uri) ? uri.slice(MEDIA_STORE_PREFIX.length) : null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb_open"));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb_req"));
  });
}

/** Persist a Blob/File; returns durable `unmask-media:<id>` URI. */
export async function persistMediaBlob(id: string, blob: Blob): Promise<string> {
  const db = await openDb();
  try {
    await idbReq(db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, id));
  } finally {
    db.close();
  }
  // Warm object URL for immediate playback in this session
  const prev = objectUrlCache.get(id);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* ignore */
    }
  }
  objectUrlCache.set(id, URL.createObjectURL(blob));
  return `${MEDIA_STORE_PREFIX}${id}`;
}

/** Turn durable / blob / http URIs into something <video>/<img> can play now. */
export async function resolvePlayableUri(uri: string): Promise<string> {
  if (!uri) return uri;
  const id = storeId(uri);
  if (!id) return uri;
  const cached = objectUrlCache.get(id);
  if (cached) return cached;
  const db = await openDb();
  try {
    const blob = await idbReq<Blob | undefined>(db.transaction(STORE, "readonly").objectStore(STORE).get(id));
    if (!blob) return uri;
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(id, url);
    return url;
  } finally {
    db.close();
  }
}

export async function revokeCachedMediaUrl(uri: string): Promise<void> {
  const id = storeId(uri);
  if (!id) return;
  const url = objectUrlCache.get(id);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    objectUrlCache.delete(id);
  }
}
