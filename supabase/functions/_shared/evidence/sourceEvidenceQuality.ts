import type { RawEvidence } from "./providers/types.ts";
import type { RawEvidenceInput } from "./types.ts";

/** Ordered source tiers — higher weight = more trusted lived-experience provenance. */
export type SourceProvenanceTier =
  | "unmask_experience"
  | "youtube_comment"
  | "reddit_comment"
  | "x_post"
  | "discourse_post"
  | "github_discussion"
  | "hackernews_comment"
  | "structured_review"
  | "web_article_excerpt"
  | "serper_snippet";

export const PROVENANCE_WEIGHT: Record<SourceProvenanceTier, number> = {
  unmask_experience: 1.1,
  youtube_comment: 1,
  reddit_comment: 0.92,
  x_post: 0.88,
  discourse_post: 0.82,
  github_discussion: 0.78,
  hackernews_comment: 0.76,
  structured_review: 0.7,
  web_article_excerpt: 0.55,
  serper_snippet: 0.38,
};

export type SourceProvenance = {
  tier: SourceProvenanceTier;
  weight: number;
};

export function provenanceWeight(tier: SourceProvenanceTier): number {
  return PROVENANCE_WEIGHT[tier];
}

function tierFromProvider(provider?: string, platform?: string): SourceProvenanceTier | null {
  const p = (provider ?? platform ?? "").toLowerCase();
  if (p === "unmask") return "unmask_experience";
  if (p === "youtube") return "youtube_comment";
  if (p === "reddit") return "reddit_comment";
  if (p === "x" || p === "twitter") return "x_post";
  if (p === "discourse" || p === "forum") return "discourse_post";
  if (p === "github") return "github_discussion";
  if (p === "hackernews" || p === "hn") return "hackernews_comment";
  if (p === "web") return "web_article_excerpt";
  return null;
}

export function resolveSourceProvenance(input: {
  provider?: string;
  platform?: string;
  sourceTitle?: string;
  url?: string;
  id?: string;
  rawMetadata?: Record<string, unknown>;
}): SourceProvenance {
  const metaTier = input.rawMetadata?.provenanceTier;
  if (typeof metaTier === "string" && metaTier in PROVENANCE_WEIGHT) {
    const tier = metaTier as SourceProvenanceTier;
    return { tier, weight: PROVENANCE_WEIGHT[tier] };
  }
  if (input.rawMetadata?.discovery === true || input.rawMetadata?.serper === true) {
    return { tier: "serper_snippet", weight: PROVENANCE_WEIGHT.serper_snippet };
  }

  const fromProvider = tierFromProvider(input.provider, input.platform);
  if (fromProvider) {
    return { tier: fromProvider, weight: PROVENANCE_WEIGHT[fromProvider] };
  }

  const platform = (input.platform ?? "").toLowerCase();
  if (platform === "review" || input.id?.startsWith("praise_") || input.id?.startsWith("complaint_")) {
    return { tier: "structured_review", weight: PROVENANCE_WEIGHT.structured_review };
  }
  if (input.id?.startsWith("src_")) {
    return { tier: "serper_snippet", weight: PROVENANCE_WEIGHT.serper_snippet };
  }
  if (platform === "web" || platform === "owner") {
    return { tier: "web_article_excerpt", weight: PROVENANCE_WEIGHT.web_article_excerpt };
  }

  return { tier: "web_article_excerpt", weight: PROVENANCE_WEIGHT.web_article_excerpt };
}

export function resolveProvenanceFromRawEvidence(item: RawEvidence): SourceProvenance {
  return resolveSourceProvenance({
    provider: item.provider,
    platform: item.platform,
    url: item.url,
    rawMetadata: item.rawMetadata,
  });
}

export function resolveProvenanceFromCollectRow(row: RawEvidenceInput): SourceProvenance {
  return resolveSourceProvenance({
    provider: row.provider,
    platform: row.platform,
    sourceTitle: row.sourceTitle,
    url: row.url,
    id: row.id,
    rawMetadata: row.rawMetadata,
  });
}

/** Scale dimension link strength — does not affect product identity gate. */
export function applyProvenanceToStrength(baseStrength: number, weight: number): number {
  return Math.min(0.95, baseStrength * weight);
}
