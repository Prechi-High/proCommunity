import { invokeCachedRead } from './cachedRead';
import { supabase } from './supabase';

export const TAXONOMY_CATEGORY = 'skincare';

export type ContentTagKey =
  | 'how_it_works'
  | 'how_to_use'
  | 'composition'
  | 'who_its_for'
  | 'results_over_time'
  | 'precautions'
  | 'comparisons';

export interface CategoryTag {
  tagKey: ContentTagKey;
  tagLabel: string;
  description: string;
  sortOrder: number;
}

export const FALLBACK_TAGS: CategoryTag[] = [
  {
    tagKey: 'how_it_works',
    tagLabel: 'How it works',
    description: 'Mechanism or science of the ingredient or product.',
    sortOrder: 1,
  },
  {
    tagKey: 'how_to_use',
    tagLabel: 'How to use',
    description: 'Application method, order, frequency, or layering.',
    sortOrder: 2,
  },
  {
    tagKey: 'composition',
    tagLabel: "What it's made of",
    description: 'Ingredient breakdown, formulation, or concentration.',
    sortOrder: 3,
  },
  {
    tagKey: 'who_its_for',
    tagLabel: "Who it's for",
    description: 'Skin type or concern suitability.',
    sortOrder: 4,
  },
  {
    tagKey: 'results_over_time',
    tagLabel: 'Results over time',
    description: 'Before/after, timelines, or visible change.',
    sortOrder: 5,
  },
  {
    tagKey: 'precautions',
    tagLabel: 'Precautions',
    description: 'Side effects, patch-testing, or irritation risk.',
    sortOrder: 6,
  },
  {
    tagKey: 'comparisons',
    tagLabel: 'Comparisons',
    description: 'Versus similar or alternative products.',
    sortOrder: 7,
  },
];

const TAG_KEYS = new Set(FALLBACK_TAGS.map((tag) => tag.tagKey));

export function asContentTagKey(value: string | null | undefined): ContentTagKey | null {
  if (!value || !TAG_KEYS.has(value as ContentTagKey)) return null;
  return value as ContentTagKey;
}

export function tagLabel(key: string): string {
  return FALLBACK_TAGS.find((tag) => tag.tagKey === key)?.tagLabel ?? key;
}

/** Map catalog product types (cleanser, serum, …) onto the reusable taxonomy category. */
export function taxonomyCategoryForProduct(): string {
  return TAXONOMY_CATEGORY;
}

export async function loadTaxonomy(category = TAXONOMY_CATEGORY): Promise<CategoryTag[]> {
  const cached = await invokeCachedRead<{
    tags?: Array<{ tagKey?: string; tagLabel?: string; description?: string; sortOrder?: number }>;
  }>({
    action: 'taxonomy',
    category,
  });
  if (cached?.tags?.length) {
    const rows = cached.tags
      .map((row) => {
        const tagKey = asContentTagKey(String(row.tagKey));
        if (!tagKey) return null;
        return {
          tagKey,
          tagLabel: String(row.tagLabel ?? tagKey),
          description: String(row.description ?? ''),
          sortOrder: Number(row.sortOrder ?? 0),
        };
      })
      .filter((row): row is CategoryTag => Boolean(row));
    if (rows.length) return rows;
  }

  if (!supabase) return FALLBACK_TAGS;
  try {
    const { data, error } = await supabase
      .from('category_tag_taxonomy')
      .select('tag_key, tag_label, description, sort_order')
      .eq('category', category)
      .order('sort_order', { ascending: true });
    if (error || !data?.length) return FALLBACK_TAGS;
    const rows = data
      .map((row) => {
        const tagKey = asContentTagKey(String(row.tag_key));
        if (!tagKey) return null;
        return {
          tagKey,
          tagLabel: String(row.tag_label ?? tagKey),
          description: String(row.description ?? ''),
          sortOrder: Number(row.sort_order ?? 0),
        };
      })
      .filter((row): row is CategoryTag => Boolean(row));
    return rows.length ? rows : FALLBACK_TAGS;
  } catch {
    return FALLBACK_TAGS;
  }
}

export async function isVideoReviewEnabled(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('app_flags')
      .select('enabled')
      .eq('key', 'video_review_enabled')
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.enabled);
  } catch {
    return false;
  }
}

/** Wilson score lower bound, 95% confidence, z = 1.96. n = 0 → 0. */
export function wilsonScore(helpful: number, notHelpful: number): number {
  const n = helpful + notHelpful;
  if (n <= 0) return 0;
  const z = 1.96;
  const phat = helpful / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  return (centre - margin) / denom;
}

export const CACHE_FIRST_THRESHOLD = 4;
export const PAGE_SIZE = 4;
