import type { ImageSourcePropType } from 'react-native';

import type { NicheId } from '@/lib/community';

export type SearchCategoryId = NicheId | 'other';

export type SearchHomeCategory = {
  id: SearchCategoryId;
  label: string;
};

export const searchHomeHero = require('@/assets/search-home/hero-unmask.png') as number;

/** Bundled category photos (mockup crops + reliable loads). */
export const SEARCH_CATEGORY_IMAGES: Record<SearchCategoryId, ImageSourcePropType> = {
  tech: require('@/assets/search-home/categories/tech.jpg'),
  care: require('@/assets/search-home/categories/care.jpg'),
  home: require('@/assets/search-home/categories/home.jpg'),
  style: require('@/assets/search-home/categories/style.jpg'),
  food: require('@/assets/search-home/categories/food.jpg'),
  auto: require('@/assets/search-home/categories/auto.jpg'),
  kids: require('@/assets/search-home/categories/kids.jpg'),
  other: require('@/assets/search-home/categories/other.jpg'),
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
