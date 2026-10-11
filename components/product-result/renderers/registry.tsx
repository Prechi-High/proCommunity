import type { ComponentType } from 'react';

import type { ProductSectionUI, RendererType } from '@/lib/product-result/contract';

import { IngredientListSection } from './IngredientListSection';
import { KeyValueListSection } from './KeyValueListSection';

export const rendererRegistry: Partial<Record<RendererType, ComponentType<{ section: ProductSectionUI }>>> = {
  key_value_list: KeyValueListSection,
  grouped_facts: KeyValueListSection,
  fact_grid: KeyValueListSection,
  ingredient_list: IngredientListSection,
  material_list: KeyValueListSection,
};
