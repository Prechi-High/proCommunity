/** First-pass product matching. Not full entity resolution. */

export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[®™]/g, '')
    .replace(/\b\d+(\.\d+)?\s?(ml|oz|g|fl\.?\s?oz)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEED_ALIASES: Record<string, string> = {
  'cerave foaming facial cleanser': 'gentle-foaming-cleanser',
  'cerave foaming cleanser': 'gentle-foaming-cleanser',
  'cerave gentle foaming cleanser': 'gentle-foaming-cleanser',
  'gentle foaming cleanser': 'gentle-foaming-cleanser',
};

export function catalogIdForQuery(query: string): string | null {
  return SEED_ALIASES[normalizeProductName(query)] ?? null;
}
