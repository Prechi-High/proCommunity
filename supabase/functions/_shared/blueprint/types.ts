export type IntelligenceDomain = "tech" | "beauty" | "home-appliances";

export type BlueprintDimensionDef = {
  key: string;
  label: string;
  importance: number;
  keywords: string[];
  whyItMatters?: string;
  description?: string;
  positiveSignals?: string[];
  negativeSignals?: string[];
  relatedConcepts?: string[];
  excludedConcepts?: string[];
};

export type BlueprintFactSectionDef = {
  key: string;
  label: string;
  renderer: string;
  fieldKeys: string[];
};

export type ProductClassification = {
  domain: IntelligenceDomain;
  categoryId: string;
  templateId: string;
  productType: string;
  productSubtype: string | null;
  classificationConfidence: number;
  primaryUses: string[];
  buyerExpectations: string[];
  riskFactors: string[];
};

export type PresentationNavItem = {
  key: string;
  label: string;
  renderer: string;
};

export type ScoreDisplay = "numeric" | "limited" | "unavailable";

export type PresentationDimension = {
  key: string;
  label: string;
  score: number | null;
  scoreDisplay: ScoreDisplay;
  confidence: number;
  evidenceCount: number;
  validatedReportCount?: number;
  limitedEvidence?: boolean;
  finding?: string;
  dimensionId?: string;
  positiveCount?: number;
  mixedCount?: number;
  negativeCount?: number;
};

export type PresentationFactField = {
  key: string;
  label: string;
  value: string;
  unit?: string | null;
};

export type PresentationFactSection = {
  key: string;
  title: string;
  renderer: string;
  fields: PresentationFactField[];
};

export type ProductPresentationContract = {
  version: number;
  blueprintId: string;
  blueprintVersion: number;
  product: {
    id: string;
    name?: string;
    category: IntelligenceDomain | string;
    domain?: {
      id: string;
      name: string;
      status: "official" | "inferred" | "proposed";
    };
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
    cacheSource?: "redis" | "supabase" | "fresh";
    /** Rows in profile.conversationEvidence when presentation was built. */
    conversationEvidenceCount?: number;
    evidenceCorpusFingerprint?: string;
    blueprintVersion?: number;
    dimensionEvidenceAlgorithm?: string;
    evidenceIdentityVersion?: string;
    evidenceRelevanceVersion?: string;
    evidenceExtractionVersion?: string;
    dimensionScoringVersion?: string;
  };
  navigation: PresentationNavItem[];
  overview: {
    score: number | null;
    scoreDisplay: ScoreDisplay;
    verdict: string;
    dimensions: PresentationDimension[];
  };
  factSections: PresentationFactSection[];
  dimensionExperience?: import("../evidence/types.ts").DimensionExperiencePackage;
  dimensionEvidenceAlgorithm?: string;
};
