import type { ProductUIContractV1 } from '@/lib/product-result/contract';

import { UnsupportedSectionFallback } from './UnsupportedSectionFallback';
import { rendererRegistry } from './renderers/registry';

const LAZY_KEYS = new Set(['evidence', 'videos', 'ask', 'overview']);

export function contractSectionForTab(contract: ProductUIContractV1, tab: string) {
  if (LAZY_KEYS.has(tab)) return null;
  return contract.sections.find((s) => s.key === tab && s.enabled) ?? null;
}

export function RenderContractSection({ contract, tab }: { contract: ProductUIContractV1; tab: string }) {
  const section = contractSectionForTab(contract, tab);
  if (!section) return null;
  const Renderer = rendererRegistry[section.renderer];
  if (!Renderer) return <UnsupportedSectionFallback section={section} />;
  return <Renderer section={section} />;
}
