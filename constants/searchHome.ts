import type { NicheId } from '@/lib/community';

export type SearchCategoryId = NicheId | 'other';

export type SearchHomeCategory = {
  id: SearchCategoryId;
  label: string;
};

/** Category photos (Unsplash) for search home grid */
export const SEARCH_CATEGORY_IMAGE_URLS: Record<SearchCategoryId, string> = {
  tech: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=480&h=360&fit=crop',
  care: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=480&h=360&fit=crop',
  home: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=480&h=360&fit=crop',
  style: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=480&h=360&fit=crop',
  food: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=480&h=360&fit=crop',
  auto: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=480&h=360&fit=crop',
  kids: 'https://images.unsplash.com/photo-1515488042361-ee00e017ddd1?w=480&h=360&fit=crop',
  other: 'https://images.unsplash.com/photo-1607083206869-4c7672cf72e7?w=480&h=360&fit=crop',
};

export const SEARCH_HOME_CATEGORIES: SearchHomeCategory[] = [
  { id: 'tech', label: 'Tech' },
  { id: 'care', label: 'Beauty & Care' },
  { id: 'home', label: 'Home' },
  { id: 'style', label: 'Fashion' },
  { id: 'food', label: 'Food & Drink' },
  { id: 'auto', label: 'Auto & Tools' },
  { id: 'kids', label: 'Baby & Kids' },
  { id: 'other', label: 'Everything Else' },
];
