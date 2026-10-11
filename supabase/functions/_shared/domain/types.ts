export type DomainStatus = "official" | "inferred" | "proposed";

export type DomainResolution = {
  matchedDomainId: string;
  domain: string;
  domainSlug: string;
  domainStatus: DomainStatus;
  productFamily: string;
  productType: string;
  productSubtype?: string;
  classificationConfidence: number;
  reason: string;
  createdInferred?: boolean;
};

export type RegistryDomain = {
  id: string;
  canonicalName: string;
  slug: string;
  status: "official" | "inferred" | "proposed" | "merged" | "deprecated";
  isOfficial: boolean;
  aliases: string[];
};
