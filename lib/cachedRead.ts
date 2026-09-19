import { supabase } from './supabase';

type CachedReadAction = 'product' | 'tagged_videos' | 'taxonomy';

/**
 * Invoke the server-side cache-aside Edge Function.
 * Returns null on any failure so callers fall back to direct Supabase.
 */
export async function invokeCachedRead<T = unknown>(
  body: Record<string, unknown> & { action: CachedReadAction },
): Promise<T | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('cached-read', { body });
    if (error) return null;
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}
