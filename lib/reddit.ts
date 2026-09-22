import { supabase } from './supabase';
export type RedditMention = { id: string; title: string; body: string; subreddit: string; url: string; score: number; createdAt: string };
/** Reddit is fetched server-side so credentials and rate limits never reach the client. */
export async function searchRedditForProduct(productName: string, brand?: string): Promise<RedditMention[]> {
  if (!supabase) return [];
  try { const { data, error } = await supabase.functions.invoke('discover-reddit-content', { body: { query: `${brand ?? ''} ${productName}`.trim(), productName, brand } }); if (error) return []; return Array.isArray(data?.mentions) ? data.mentions : []; } catch { return []; }
}
