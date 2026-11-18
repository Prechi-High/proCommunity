/** Avoid QuotaExceededError when persisting posts with giant data URIs. */
const MAX_PERSIST_CHARS = 1_400_000;

export function isOversizedDataUri(uri: string | undefined | null): boolean {
  return Boolean(uri && uri.startsWith("data:") && uri.length > MAX_PERSIST_CHARS);
}

export function pickPersistableMediaUri(preferred: string | undefined, fallback: string): string {
  if (!preferred) return fallback;
  if (isOversizedDataUri(preferred)) return fallback;
  return preferred;
}