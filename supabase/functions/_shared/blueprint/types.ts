export type IntelligenceDomain = "tech" | "beauty" | "home-appliances";

export type BlueprintDimensionDef = {
  key: string;
  label: string;
  importance: number;
  keywords: string[];
  whyItMatters?: string;
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

export type PresentationDimension = {
  key: string;
  label: string;
  score: number | null;
  confidence: number;
  evidenceCount: number;
  limitedEvidence?: boolean;
  finding?: string;
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
  };
  navigation: PresentationNavItem[];
  overview: {
    score: number | null;
    verdict: string;
    dimensions: PresentationDimension[];
  };
  factSections: PresentationFactSection[];
};
