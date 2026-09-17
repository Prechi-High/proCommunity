/**
 * Real photography used across the app.
 *
 * Every URL here points at a real, human-taken photograph on the Pexels CDN
 * (Pexels licence: free to use, no attribution required). None of these are
 * generated. Seeded community photos are labelled as starter content in the UI
 * so a reader can always tell what came from a Sourced owner and what did not.
 */

const CDN = 'https://images.pexels.com/photos';

/** Build a cropped, compressed CDN URL at the size we actually render. */
export function photo(id: string, width: number, height?: number): string {
  const parts = [`auto=compress`, `cs=tinysrgb`, `w=${width}`];
  if (height) parts.push(`h=${height}`, 'fit=crop');
  return `${CDN}/${id}/pexels-photo-${id}.jpeg?${parts.join('&')}`;
}

/** Portraits for the seeded community voices. */
export const AUTHOR_PHOTO_IDS: Record<string, string> = {
  'user-amara': '22619770',
  'user-ken': '30124372',
  'user-zainab': '36322504',
  'user-tola': '23458386',
};

/** Product photography for the seed catalog. Live products use their own image. */
export const PRODUCT_PHOTO_IDS: Record<string, string> = {
  'niacinamide-10-zinc': '12146904',
  'gentle-foaming-cleanser': '16378446',
  'barrier-repair-moisturizer': '8709568',
  'clarifying-niacinamide-gel': '8101529',
  'balance-serum-5': '35899861',
  'pore-minimizing-essence': '12352170',
  'vitamin-c-15': '4119559',
  'clay-mask': '8167170',
  'mineral-spf-50': '20171275',
  'salicylic-cleanser': '8101512',
  'barrier-repair-cream': '8101673',
};

/** Photos attached to the seeded Discovery Feed posts. */
export const POST_PHOTO_IDS: Record<string, string> = {
  'feed-1': '7269488',
  'feed-2': '8102021',
  'feed-3': '9442300',
  'feed-4': '8100691',
  'feed-5': '6728431',
  'feed-6': '10159288',
  'feed-7': '4119559',
  'feed-8': '8167170',
  'feed-9': '20171275',
  'feed-10': '8101512',
};

/** Warm, unhurried opener for the sign-in screen. */
export const ONBOARDING_PHOTO_ID = '7113560';

export function authorPhoto(userId: string, size = 96): string | null {
  const id = AUTHOR_PHOTO_IDS[userId];
  return id ? photo(id, size, size) : null;
}

export function productPhoto(productId: string, width = 600, height?: number): string | null {
  const id = PRODUCT_PHOTO_IDS[productId];
  return id ? photo(id, width, height) : null;
}

export function postPhoto(postId: string, width = 600, height?: number): string | null {
  const id = POST_PHOTO_IDS[postId];
  return id ? photo(id, width, height) : null;
}
