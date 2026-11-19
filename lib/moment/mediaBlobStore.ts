/** Native: no IndexedDB — URIs pass through. */
export const MEDIA_STORE_PREFIX = "unmask-media:";

export function isMediaStoreUri(uri: string | undefined | null): boolean {
  return Boolean(uri && uri.startsWith(MEDIA_STORE_PREFIX));
}

export async function persistMediaBlob(_id: string, _blob: Blob): Promise<string> {
  throw new Error("media_store_web_only");
}

export async function resolvePlayableUri(uri: string): Promise<string> {
  return uri;
}

export async function revokeCachedMediaUrl(_uri: string): Promise<void> {
  /* no-op */
}
