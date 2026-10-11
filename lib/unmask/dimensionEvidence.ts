import type { ProductProfile } from '@/lib/types';

export type DimensionEvidenceItem = {
  evidenceId: string;
  statement: string;
  fullText?: string;
  platform: string;
  url: string;
  stance: 'positive' | 'mixed' | 'negative' | 'neutral';
  strength: number;
  relevanceConfidence: number;
  productMatchConfidence: number;
  productMatchLevel?: string;
  affectsScore: boolean;
  author?: string;
  parentId?: string;
  parentText?: string;
  parentAuthor?: string;
  isReply?: boolean;
  conversationId?: string;
  videoTitle?: string;
  sourceContext?: string;
  createdAt?: string;
  provider?: string;
};

export type DimensionExperienceRoot = {
  algorithmVersion: string;
  byKey: Record<string, DimensionExperienceBundle>;
};

export type ScoreDisplay = 'numeric' | 'limited' | 'unavailable';

export type DimensionExperienceBundle = {
  dimensionId: string;
  dimensionKey: string;
  label: string;
  score: number | null;
  scoreDisplay?: ScoreDisplay;
  confidence: number;
  finding: string;
  positiveCount: number;
  mixedCount: number;
  negativeCount: number;
  excludedCount: number;
  evidenceCount: number;
  validatedReportCount?: number;
  uniqueSourceCount?: number;
  uniqueVideoCount?: number;
  uniqueAuthorCount?: number;
  sufficiencyGate?: {
    sufficientForNumericScore: boolean;
    failedConditions: string[];
    displayReason: string;
    avgRelevance: number;
    avgProductMatch: number;
  };
  items: DimensionEvidenceItem[];
};

export function getDimensionExperience(
  profile: ProductProfile,
  dimensionKey: string,
): DimensionExperienceBundle | null {
  const exp = profile.dimensionExperience?.byKey?.[dimensionKey];
  if (exp) return exp as DimensionExperienceBundle;
  const pres = profile.presentation as { dimensionExperience?: { byKey: Record<string, DimensionExperienceBundle> } } | undefined;
  const fromPres = pres?.dimensionExperience?.byKey?.[dimensionKey];
  return fromPres ?? null;
}

export function resolveDimensionKey(profile: ProductProfile, dimensionIdOrKey: string): string {
  const contract = profile.uiContract;
  const fromContract = contract?.overview.dimensions.find(
    (d) => d.dimension_id === dimensionIdOrKey || d.id === dimensionIdOrKey || d.key === dimensionIdOrKey,
  );
  if (fromContract) return fromContract.key;
  const exp = profile.dimensionExperience?.byKey ?? {};
  if (exp[dimensionIdOrKey]) return dimensionIdOrKey;
  const match = Object.values(exp).find((b) => b.dimensionId === dimensionIdOrKey);
  return match?.dimensionKey ?? dimensionIdOrKey.replace(/^dim_/, '');
}
