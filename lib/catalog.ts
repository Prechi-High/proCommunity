import { getCachedProduct } from './openBeautyFacts';
import { authors, communityPosts, listings, literacyEntries, products } from './seed';
import type { CommunityPost, Listing, LiteracyEntry, Product } from './types';

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

export function getAuthorPosts(userId: string, extra: CommunityPost[] = []): CommunityPost[] {
  return [...communityPosts, ...extra].filter(
    (post) => post.userId === userId && post.status === 'visible',
  );
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
