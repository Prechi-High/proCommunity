export type ProductMatchLevel = "exact" | "probable" | "contextual" | "unrelated";

export type EvidenceStance = "positive" | "mixed" | "negative" | "neutral";

export type RawEvidenceInput = {
  id: string;
  text: string;
  platform: string;
  author?: string;
  url?: string;
  sourceTitle?: string;
  provider?: string;
  sourceId?: string;
  conversationId?: string;
  parentId?: string;
  contextText?: string;
  createdAt?: string;
  experienceAffectsScoring?: boolean;
  provenanceTier?: string;
  provenanceWeight?: number;
  rawMetadata?: Record<string, unknown>;
};

export type ProductMatchResult = {
  level: ProductMatchLevel;
  confidence: number;
  brandMatch: boolean;
  nameMatch: boolean;
  affectsScore: boolean;
  reason: string;
  isolatedStatement?: string;
};

export type DimensionRelevanceResult = {
  dimensionKey: string;
  relevanceConfidence: number;
  stance: EvidenceStance;
  strength: number;
  affectsScore: boolean;
  reason: string;
};

export type NormalizedEvidenceRow = {
  evidenceId: string;
  text: string;
  extractedStatement: string;
  platform: string;
  author: string;
  url: string;
  sourceTitle: string;
  provider?: string;
  sourceId?: string;
  conversationId?: string;
  parentId?: string;
  provenanceWeight?: number;
  productMatch: ProductMatchResult;
  dimensionLinks: DimensionRelevanceResult[];
};

export type ScoreDisplay = "numeric" | "limited" | "unavailable";

export type DimensionScoreBundle = {
  dimensionId: string;
  dimensionKey: string;
  label: string;
  score: number | null;
  scoreDisplay: ScoreDisplay;
  confidence: number;
  finding: string;
  positiveCount: number;
  mixedCount: number;
  negativeCount: number;
  excludedCount: number;
  evidenceCount: number;
  validatedReportCount: number;
  uniqueSourceCount: number;
  items: Array<{
    evidenceId: string;
    statement: string;
    platform: string;
    author?: string;
    url: string;
    stance: EvidenceStance;
    strength: number;
    relevanceConfidence: number;
    productMatchConfidence: number;
    affectsScore: boolean;
  }>;
};

export type DimensionExperiencePackage = {
  algorithmVersion: string;
  byKey: Record<string, DimensionScoreBundle>;
  /** Serialized evidence rows for DB persist (not sent to client). */
  normalizedRows?: NormalizedEvidenceRow[];
};
