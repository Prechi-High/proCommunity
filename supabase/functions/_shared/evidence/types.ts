export type ProductMatchLevel =
  | "exact"
  | "variant_related"
  | "comparison_context"
  | "contextual"
  | "probable"
  | "unrelated";

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
  parentAuthor?: string;
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
  extractedStatement?: string;
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
  parentAuthor?: string;
  contextText?: string;
  createdAt?: string;
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
  uniqueVideoCount?: number;
  uniqueAuthorCount?: number;
  sufficiencyGate?: {
    sufficientForNumericScore: boolean;
    failedConditions: string[];
    displayReason: string;
    avgRelevance: number;
    avgProductMatch: number;
    evidenceCount?: number;
    uniqueAuthors?: number;
    uniqueSources?: number;
    uniqueConversations?: number;
    uniqueVideos?: number;
    agreement?: number;
  };
  items: Array<DimensionEvidenceDisplayItem>;
};

export type DimensionEvidenceDisplayItem = {
  evidenceId: string;
  statement: string;
  fullText?: string;
  platform: string;
  author?: string;
  url: string;
  stance: EvidenceStance;
  strength: number;
  relevanceConfidence: number;
  productMatchConfidence: number;
  productMatchLevel?: ProductMatchLevel;
  affectsScore: boolean;
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

export type DimensionExperiencePackage = {
  algorithmVersion: string;
  byKey: Record<string, DimensionScoreBundle>;
  /** Serialized evidence rows for DB persist (not sent to client). */
  normalizedRows?: NormalizedEvidenceRow[];
};
