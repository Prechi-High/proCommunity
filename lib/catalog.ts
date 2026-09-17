import { getCachedProduct } from './openBeautyFacts';
import {
  authors,
  communityPosts,
  discussionThreads,
  listings,
  literacyEntries,
  products,
  youtubeComments as seedYoutubeComments,
} from './seed';
import type {
  CommunityPost,
  DiscussionThread,
  Listing,
  LiteracyEntry,
  Product,
  YoutubeComment,
} from './types';

export interface ThreadSummary extends DiscussionThread {
  replyCount: number;
  preview: string;
  lastActiveAt: string;
}

export function routeId(id: string | string[] | undefined): string {
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
}

/** Product detail must use this. It never returns listings or prices. */
export function getProduct(id: string): Product | undefined {
  return getCachedProduct(id) ?? products.find((product) => product.id === id);
}

export function getAllProducts(): Product[] {
  return products;
}

export function getProductPosts(productId: string, extra: CommunityPost[] = []): CommunityPost[] {
  return [...communityPosts, ...extra]
    .filter((post) => post.productId === productId && post.status === 'visible')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getLiteracyForProduct(product: Product): LiteracyEntry[] {
  const keys = new Set([...product.ingredients, ...product.attributeTags]);
  return literacyEntries.filter((entry) => keys.has(entry.attributeTag));
}

/** Store list only. Do not import this from the product detail route. */
export function getListingsForProduct(productId: string): Listing[] {
  return listings.filter((listing) => listing.productId === productId && !listing.optedOut);
}

export function countListings(productId: string): number {
  return getListingsForProduct(productId).length;
}

export function lowestPrice(productId: string): { price: number; currency: 'NGN' } | null {
  const inStock = getListingsForProduct(productId).filter((listing) => listing.inStock);
  if (inStock.length === 0) return null;
  const price = Math.min(...inStock.map((listing) => listing.price));
  return { price, currency: 'NGN' };
}

export function trackingCount(productId: string, extraUserIds: string[] = []): number {
  const fromPosts = new Set(
    communityPosts.filter((post) => post.productId === productId).map((post) => post.userId),
  );
  extraUserIds.forEach((id) => fromPosts.add(id));
  return fromPosts.size;
}

export function getAuthor(userId: string) {
  return Object.values(authors).find((author) => author.id === userId);
}

/** Portrait for a community voice. Returns null for the signed-in user's own posts. */
export function authorAvatar(userId: string): string | null {
  return getAuthor(userId)?.avatarUrl ?? null;
}

/** Initials fallback so a missing portrait still reads as a person, not a blank. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function getAuthorPosts(userId: string, extra: CommunityPost[] = []): CommunityPost[] {
  return [...communityPosts, ...extra].filter(
    (post) => post.userId === userId && post.status === 'visible',
  );
}

export function timeAgo(iso: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 3_600_000));
  if (hours < 1) return 'active just now';
  if (hours < 24) return `active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'active yesterday';
  if (days < 7) return `active ${days}d ago`;
  return `active ${Math.floor(days / 7)}w ago`;
}

function fallbackThreads(productId: string): DiscussionThread[] {
  return [
    {
      id: `thread-${productId}-general`,
      productId,
      title: 'General discussion',
      createdBy: 'sourced',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

export function getProductThreads(
  productId: string,
  extraThreads: DiscussionThread[] = [],
  extraPosts: CommunityPost[] = [],
): ThreadSummary[] {
  const seeded = discussionThreads.filter((thread) => thread.productId === productId);
  const extras = extraThreads.filter((thread) => thread.productId === productId);
  const threads = [...seeded, ...extras];
  const list = threads.length ? threads : fallbackThreads(productId);
  const posts = getProductPosts(productId, extraPosts).filter((post) => post.type !== 'feed_post');
  return list
    .map((thread) => {
      const isGeneral = thread.id.endsWith('-general');
      const threadPosts = posts.filter((post) =>
        isGeneral ? !post.threadId || post.threadId === thread.id : post.threadId === thread.id,
      );
      const latest = threadPosts[0];
      return {
        ...thread,
        replyCount: threadPosts.length,
        preview: latest?.body ?? 'No replies yet — start this conversation.',
        lastActiveAt: latest?.createdAt ?? thread.createdAt,
      };
    })
    .sort((a, b) => +new Date(b.lastActiveAt) - +new Date(a.lastActiveAt));
}

export function getThread(threadId: string, extraThreads: DiscussionThread[] = []): DiscussionThread | undefined {
  return [...discussionThreads, ...extraThreads].find((thread) => thread.id === threadId);
}

export function getThreadPosts(
  threadId: string,
  extraPosts: CommunityPost[] = [],
  productId?: string,
): CommunityPost[] {
  return [...communityPosts, ...extraPosts]
    .filter((post) => post.status === 'visible' && post.type !== 'feed_post')
    .filter((post) => {
      if (productId && post.productId !== productId) return false;
      if (threadId.endsWith('-general')) {
        return !post.threadId || post.threadId === threadId;
      }
      return post.threadId === threadId;
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getFeedPosts(productId?: string, extra: CommunityPost[] = []): CommunityPost[] {
  return [...communityPosts, ...extra]
    .filter((post) => post.status === 'visible' && (post.type === 'feed_post' || Boolean(post.photoUrl)))
    .filter((post) => !productId || post.productId === productId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function relatedPosts(seed: CommunityPost, extra: CommunityPost[] = []): CommunityPost[] {
  const words = new Set(
    seed.body
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4),
  );
  return [...communityPosts, ...extra]
    .filter(
      (post) =>
        post.id !== seed.id &&
        post.status === 'visible' &&
        post.productId === seed.productId &&
        post.type !== 'feed_post',
    )
    .map((post) => ({
      post,
      score: post.body
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => words.has(word)).length,
    }))
    .filter((row) => row.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.post);
}

export function getSeedYoutubeComments(productId: string): YoutubeComment[] {
  return seedYoutubeComments.filter((comment) => comment.productId === productId);
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export function categoryLabel(category: Product['category']): string {
  return category.replace('_', ' ');
}

export function tagLabel(tag: string): string {
  return tag.split('_').join('-');
}

const ALIASES: Record<string, string[]> = {
  mattifying: ['mattifying', 'matte', 'oil control', 'shine'],
  hydrating: ['hydrating', 'dewy', 'moisturizing'],
  fragrance_free: ['fragrance-free', 'fragrance free', 'unscented'],
  oil_free: ['oil-free', 'oil free'],
  niacinamide: ['niacinamide', 'b3', 'vitamin b3'],
  barrier_repair: ['barrier', 'ceramides'],
  gentle: ['gentle', 'sensitive'],
  vitamin_c: ['vitamin c', 'ascorbic', 'brightening'],
  oily: ['oily', 'oil'],
  combination: ['combination', 'combo'],
  dry: ['dry'],
  sensitive: ['sensitive'],
};

export function searchProducts(query: string, chip?: string): Product[] {
  const q = query.trim().toLowerCase();
  return products.filter((product) => {
    const hay = [
      product.name,
      product.brand,
      product.category,
      product.description,
      ...product.ingredients,
      ...product.attributeTags,
      ...product.suitsSkinTypes,
    ]
      .join(' ')
      .toLowerCase();

    const aliasHit = Object.entries(ALIASES).some(([tag, words]) => {
      if (!q) return false;
      return words.some((word) => q.includes(word)) && hay.includes(tag.replace('_', ' '));
    });

    const textHit =
      !q ||
      hay.includes(q) ||
      aliasHit ||
      product.attributeTags.some((tag) =>
        (ALIASES[tag] ?? [tag]).some((word) => q.includes(word)),
      );

    const chipHit =
      !chip ||
      product.attributeTags.includes(chip) ||
      product.suitsSkinTypes.includes(chip as Product['suitsSkinTypes'][number]) ||
      product.ingredients.includes(chip);

    return textHit && chipHit;
  });
}
