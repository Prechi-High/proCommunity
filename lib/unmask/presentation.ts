import type { ProductProfile } from '@/lib/types';

import type { UnmaskTab } from './types';

export type PresentationNavItem = {
  key: string;
  label: string;
  renderer: string;
};

export type ProductPresentation = {
  version: number;
  blueprintId: string;
  blueprintVersion: number;
  product: {
    id: string;
    name?: string;
    category: string;
    domain?: { id: string; name: string; status: 'official' | 'inferred' | 'proposed' };
    productFamily?: string;
    productType: string;
    productSubtype: string | null;
  };
  domainNotice?: {
    shouldShow: boolean;
    officialDomains: string[];
    canVote: boolean;
  };
  intelligenceMeta?: {
    blueprintVersion: number;
    domainTemplateVersion: number;
    classificationConfidence: number;
    cacheSource?: 'redis' | 'supabase' | 'fresh';
  };
  navigation: PresentationNavItem[];
  overview: {
    score: number | null;
    verdict: string;
    dimensions: Array<{
      key: string;
      label: string;
      score: number | null;
      confidence: number;
      evidenceCount: number;
      limitedEvidence?: boolean;
      finding?: string;
    }>;
  };
  factSections: Array<{
    key: string;
    title: string;
    renderer: string;
    fields: Array<{ key: string; label: string; value: string; unit?: string | null }>;
  }>;
};

export function getPresentation(profile: ProductProfile | null): ProductPresentation | null {
  const p = (profile as ProductProfile & { presentation?: ProductPresentation })?.presentation;
  return p?.version ? p : null;
}

const CORE_TABS = new Set(['overview', 'evidence', 'videos', 'ask']);

export function isFactTab(tab: string): boolean {
  return !CORE_TABS.has(tab);
}

export function navigationTabs(profile: ProductProfile | null): PresentationNavItem[] | null {
  const pres = getPresentation(profile);
  return pres?.navigation?.length ? pres.navigation : null;
}

export function defaultTabs(): PresentationNavItem[] {
  return [
    { key: 'overview', label: 'Overview', renderer: 'overview' },
    { key: 'specs', label: 'Specs', renderer: 'fact_groups' },
    { key: 'evidence', label: 'Evidence', renderer: 'evidence' },
    { key: 'videos', label: 'Videos', renderer: 'video_evidence' },
    { key: 'ask', label: 'Ask', renderer: 'ask' },
  ];
}

export function normalizeTab(tab: string): UnmaskTab {
  return tab as UnmaskTab;
}

export function factSectionForTab(profile: ProductProfile | null, tab: string) {
  const pres = getPresentation(profile);
  if (tab === 'specs') {
    return pres?.factSections.find((s) => s.key === 'specs') ?? pres?.factSections[0] ?? null;
  }
  return pres?.factSections.find((s) => s.key === tab) ?? null;
}

export function firstFactTabKey(profile: ProductProfile | null): UnmaskTab {
  const pres = getPresentation(profile);
  const fact = pres?.navigation.find((n) => isFactTab(n.key));
  return (fact?.key ?? 'specs') as UnmaskTab;
}
