import { callIntel } from '@/lib/products';
import type { ProductUIContractV1 } from '@/lib/product-result/contract';

export type AskUnmaskApiAnswer = {
  kind: 'answer';
  question: string;
  shortAnswer: string;
  reused?: boolean;
  evidence: Array<{ summary: string; origin: string; dimensionKey?: string }>;
  dimensionKey?: string;
};

export type AskUnmaskApiInsufficient = {
  kind: 'insufficient';
  hint: string;
  reused?: boolean;
};

export async function askUnmaskFromEdge(input: {
  productId: string;
  question: string;
  sectionKey?: string;
  dimensionKey?: string;
  uiContract?: ProductUIContractV1 | null;
}): Promise<AskUnmaskApiAnswer | AskUnmaskApiInsufficient> {
  const ctx = input.uiContract?.ask_context;
  const res = await callIntel<AskUnmaskApiAnswer | AskUnmaskApiInsufficient>({
    action: 'ask_unmask',
    productId: input.productId,
    question: input.question,
    askContext: {
      product_id: input.productId,
      blueprint_id: ctx?.blueprint_id ?? input.uiContract?.intelligence_meta.blueprint_id,
      section_key: input.sectionKey,
      dimension_key: input.dimensionKey,
      available_fact_keys: ctx?.available_fact_keys ?? [],
      available_dimension_keys: ctx?.available_dimension_keys ?? [],
    },
  });
  return res;
}
