import type { BlueprintDimensionDef } from "../../blueprint/types.ts";
import type { IntelligenceDomain } from "../../blueprint/types.ts";

export type ProviderId =
  | "youtube"
  | "reddit"
  | "x"
  | "discourse"
  | "github"
  | "hackernews"
  | "web";

export type ProviderHealth = {
  ok: boolean;
  reason?: string;
};

export type EvidenceEngagement = {
  likes?: number;
  replies?: number;
  score?: number;
};

/** Normalized conversation evidence from any provider. */
export type RawEvidence = {
  provider: ProviderId;
  platform: string;
  sourceId: string;
  conversationId?: string;
  parentId?: string;
  author?: string;
  text: string;
  title?: string;
  url?: string;
  createdAt?: string;
  engagement?: EvidenceEngagement;
  /** Parent/thread text for reply disambiguation (not always shown). */
  contextText?: string;
  rawMetadata?: Record<string, unknown>;
};

export type EvidenceSearchInput = {
  productId: string;
  productName: string;
  brand?: string;
  model?: string;
  variant?: string;
  domain: IntelligenceDomain | "inferred";
  productType?: string;
  productSubtype?: string | null;
  aliases?: string[];
  dimensions?: BlueprintDimensionDef[];
  evidenceTopics?: string[];
  buyerExpectations?: string[];
  riskFactors?: string[];
  primaryUses?: string[];
  maxItems?: number;
  country?: string;
  forceRefresh?: boolean;
  cacheStore?: {
    getJson<T>(key: string): Promise<{ ok: boolean; value: T | null }>;
    setJson(key: string, value: unknown, ttlSec: number): Promise<unknown>;
  };
};

export type ProviderSearchResult = {
  provider: ProviderId;
  status: "ok" | "disabled" | "error" | "skipped";
  items: RawEvidence[];
  error?: string;
  requestsUsed?: number;
  acquisition?: Record<string, unknown>;
};

export interface EvidenceProvider {
  id: ProviderId;
  searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult>;
  fetchConversation?(conversationId: string): Promise<RawEvidence[]>;
  healthCheck?(): Promise<ProviderHealth>;
}

export type ProviderDiagnostics = Record<
  ProviderId,
  { status: string; items: number; error?: string; acquisition?: Record<string, unknown> }
>;
