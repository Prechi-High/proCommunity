import { callIntel } from './products';
import { useAppStore } from './store';
import type { AskAnswer, CommunityNotification, CommunityReply, CommunityThread, Product, ProductRoom, Pulse, ThreadKind } from './types';

/**
 * Shared community layer. Threads, replies, questions and trending signals live in
 * Supabase (via the product-intelligence edge function) so every member sees them.
 */

function me(): { id: string; name: string } | null {
  const p = useAppStore.getState().profile;
  return p ? { id: p.id, name: p.displayName } : null;
}

export async function fetchThreads(productId?: string): Promise<CommunityThread[]> {
  const res = await callIntel<{ threads?: CommunityThread[] }>({ action: 'threads', productId }, 15000);
  return res.threads ?? [];
}

export type FeedSort = 'hot' | 'new' | 'top';

export async function fetchFeed(input: { sort?: FeedSort; kind?: ThreadKind | null; productId?: string; q?: string; limit?: number } = {}): Promise<CommunityThread[]> {
  const res = await callIntel<{ threads?: CommunityThread[] }>(
    { action: 'feed', sort: input.sort ?? 'hot', kind: input.kind ?? undefined, productId: input.productId, q: input.q, limit: input.limit, memberId: me()?.id },
    15000,
  );
  return res.threads ?? [];
}

export async function fetchFollowing(): Promise<CommunityThread[]> {
  const m = me();
  if (!m) return [];
  const res = await callIntel<{ threads?: CommunityThread[] }>({ action: 'following', memberId: m.id }, 15000);
  return res.threads ?? [];
}

export async function voteThread(threadId: string, on: boolean): Promise<number> {
  const m = me();
  if (!m) throw new Error('join_first');
  const res = await callIntel<{ votes?: number }>({ action: 'vote', threadId, on, memberId: m.id }, 10000);
  return res.votes ?? 0;
}

export async function followThread(threadId: string, on: boolean): Promise<number> {
  const m = me();
  if (!m) throw new Error('join_first');
  const res = await callIntel<{ followers?: number }>({ action: 'follow', threadId, on, memberId: m.id }, 10000);
  return res.followers ?? 0;
}

export async function fetchNotifications(): Promise<{ notifications: CommunityNotification[]; unread: number }> {
  const m = me();
  if (!m) return { notifications: [], unread: 0 };
  const res = await callIntel<{ notifications?: CommunityNotification[]; unread?: number }>({ action: 'notifications', memberId: m.id }, 10000);
  return { notifications: res.notifications ?? [], unread: res.unread ?? 0 };
}

export async function markNotificationsRead(): Promise<void> {
  const m = me();
  if (m) await callIntel({ action: 'notifications_read', memberId: m.id }, 8000).catch(() => undefined);
}

export async function fetchRoom(productId: string): Promise<ProductRoom | null> {
  const res = await callIntel<{ room?: ProductRoom }>({ action: 'room', productId }, 12000);
  return res.room ?? null;
}

export async function uploadPostImage(base64: string, mimeType: string): Promise<string> {
  const res = await callIntel<{ url?: string }>({ action: 'upload', imageBase64: base64, mimeType }, 40000);
  if (!res.url) throw new Error('upload_failed');
  return res.url;
}

export async function fetchThread(threadId: string): Promise<CommunityThread | null> {
  const res = await callIntel<{ thread?: CommunityThread | null }>({ action: 'thread', threadId, memberId: me()?.id }, 15000);
  const t = res.thread ?? null;
  if (t?.community_replies) {
    t.community_replies.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }
  return t;
}

export async function postThread(input: {
  product: Pick<Product, 'id' | 'name' | 'brand' | 'category' | 'heroImageUrl'>;
  kind: ThreadKind;
  title: string;
  body?: string;
  compare?: Pick<Product, 'id' | 'name' | 'brand' | 'heroImageUrl'> | null;
  imageUrl?: string | null;
  rating?: number | null;
}): Promise<CommunityThread> {
  const author = me();
  if (!author) throw new Error('join_first');
  const res = await callIntel<{ thread?: CommunityThread }>(
    {
      action: 'post',
      author,
      productId: input.product.id,
      productName: input.product.name,
      productImage: input.product.heroImageUrl ?? null,
      category: input.product.category,
      kind: input.kind,
      title: input.title,
      body: input.body,
      compareId: input.compare?.id,
      compareName: input.compare?.name,
      compareImage: input.compare?.heroImageUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      rating: input.rating ?? null,
      brand: input.product.brand,
    },
    15000,
  );
  if (!res.thread) throw new Error('post_failed');
  return res.thread;
}

export async function postReply(threadId: string, body: string, isOwner: boolean): Promise<CommunityReply> {
  const author = me();
  if (!author) throw new Error('join_first');
  const res = await callIntel<{ reply?: CommunityReply }>({ action: 'reply', threadId, body, isOwner, author }, 15000);
  if (!res.reply) throw new Error('reply_failed');
  return res.reply;
}

export async function markHelpful(replyId: string): Promise<void> {
  await callIntel({ action: 'helpful', replyId }, 10000).catch(() => undefined);
}

export async function askOwners(productId: string, question: string, compareId?: string): Promise<AskAnswer> {
  return callIntel<AskAnswer>({ action: 'ask', productId, question, compareId }, 40000);
}

export async function fetchPulse(category?: string): Promise<Pulse> {
  return callIntel<Pulse>({ action: 'pulse', category }, 15000);
}

export function trackProduct(
  product: Pick<Product, 'id' | 'name' | 'brand' | 'category' | 'heroImageUrl'>,
  event: 'view' | 'compare' | 'save',
): void {
  void callIntel(
    {
      action: 'track',
      event,
      productId: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      image: product.heroImageUrl ?? null,
    },
    8000,
  ).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Niches — broad groupings over the free-form categories the intelligence layer returns.

export const NICHES = [
  { id: 'tech', label: 'Tech', re: /phone|charger|laptop|computer|tablet|headphone|earbud|speaker|camera|tv|television|console|game|watch|electronic|audio|power bank|router|monitor|keyboard|mouse|drone|solar|inverter|battery/i },
  { id: 'home', label: 'Home', re: /home|kitchen|blender|fridge|appliance|vacuum|furniture|mattress|bed|air|fan|cook|fryer|kettle|iron|lamp|decor|clean/i },
  { id: 'care', label: 'Beauty & care', re: /beauty|skin|hair|cosmetic|makeup|fragrance|perfume|care|grooming|shav|serum|lotion|cream|soap/i },
  { id: 'style', label: 'Fashion', re: /shoe|sneaker|cloth|shirt|dress|bag|fashion|jean|jacket|apparel|wear|jewel/i },
  { id: 'food', label: 'Food & drink', re: /food|drink|snack|coffee|tea|beverage|grocery|supplement|protein|vitamin|nutrition/i },
  { id: 'auto', label: 'Auto & tools', re: /car|auto|vehicle|tyre|tire|tool|drill|motor|bike/i },
  { id: 'kids', label: 'Baby & kids', re: /baby|kid|toy|child|diaper|stroller/i },
] as const;

export type NicheId = (typeof NICHES)[number]['id'] | 'other';

export function nicheOf(category: string | null | undefined): NicheId {
  const c = category ?? '';
  return NICHES.find((n) => n.re.test(c))?.id ?? 'other';
}

export function nicheLabel(id: NicheId): string {
  return NICHES.find((n) => n.id === id)?.label ?? 'Everything else';
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - +new Date(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}y ago`;
}

export const KIND_LABEL: Record<ThreadKind, string> = {
  question: 'Question',
  worry: 'Worry',
  experience: 'Experience',
  compare: 'Comparison',
  tip: 'Tip',
  review: 'Review',
};
