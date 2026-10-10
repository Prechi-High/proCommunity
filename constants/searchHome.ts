import type { ImageSourcePropType } from 'react-native';

import type { NicheId } from '@/lib/community';

export type SearchCategoryId = NicheId | 'other';

/** Static category photos cropped from go-ahead search.png */
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

export type SearchHomeCategory = {
  id: SearchCategoryId;
  label: string;
  subtitle: string;
};

/** Category grid copy from go-ahead search mockup. */
export const SEARCH_HOME_CATEGORIES: SearchHomeCategory[] = [
  { id: 'tech', label: 'Tech', subtitle: 'Specs, battery, performance' },
  { id: 'care', label: 'Beauty & Care', subtitle: 'Ingredients, skin type, results' },
  { id: 'home', label: 'Home', subtitle: 'Quality, materials, real use' },
  { id: 'style', label: 'Fashion', subtitle: 'Fit, material, durability' },
  { id: 'food', label: 'Food & Drink', subtitle: 'Ingredients, nutrition, taste' },
  { id: 'auto', label: 'Auto & Tools', subtitle: 'Reliability, performance, value' },
  { id: 'kids', label: 'Baby & Kids', subtitle: 'Safety, materials, parent reviews' },
  { id: 'other', label: 'Everything Else', subtitle: 'Other products and unique finds' },
];
