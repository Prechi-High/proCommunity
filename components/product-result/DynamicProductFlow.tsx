import { getUIContract, navigationFromContract } from '@/lib/product-result/contract';
import type { ProductProfile } from '@/lib/types';
import type { PresentationNavItem } from '@/lib/unmask/presentation';

/** Navigation items for `ProductSubTabs` when a UI contract is on the profile. */
export function contractNavigationForSubTabs(profile: ProductProfile | null): PresentationNavItem[] | null {
  const contract = getUIContract(profile);
  if (!contract) return null;
  return navigationFromContract(contract).map((n) => ({
    key: n.key,
    label: n.label,
    renderer: n.section_ref,
  }));
}
