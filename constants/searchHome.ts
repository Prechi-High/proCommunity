import type { NicheId } from '@/lib/community';

export type SearchCategoryId = NicheId | 'other';

export type SearchHomeCategory = {
  id: SearchCategoryId;
  label: string;
};

export const searchHomeHero = require('@/assets/search-home/hero-unmask.png') as number;

/** Remote category photos (Unsplash, stable IDs). */
export const SEARCH_CATEGORY_IMAGE_URLS: Record<SearchCategoryId, string> = {
  tech: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80&auto=format&fit=crop',
  care: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&auto=format&fit=crop',
  home: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80&auto=format&fit=crop',
  style: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&q=80&auto=format&fit=crop',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80&auto=format&fit=crop',
  auto: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80&auto=format&fit=crop',
  kids: 'https://images.unsplash.com/photo-1515488042361-ee00e017ddd1?w=400&q=80&auto=format&fit=crop',
  other: 'https://images.unsplash.com/photo-1607083206869-4c7672cf72e7?w=400&q=80&auto=format&fit=crop',
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
