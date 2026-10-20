import { gatherConversationEvidence } from "./gatherConversationEvidence.ts";
import { redisEvidenceProviderCache } from "./providerCacheStore.ts";
import { inferDomainFromCategory, planEvidenceQueries } from "./queryPlanner.ts";
import { YOUTUBE_LIMITS } from "./providers/youtube/limits.ts";
import { presetsForDomain } from "../blueprint/presets.ts";
import type { EvidenceSearchInput } from "./providers/types.ts";
import type { IntelligenceDomain } from "../blueprint/types.ts";

type Json = Record<string, unknown>;

export function buildEvidenceSearchInputFromProfile(productId: string, query: string, profile: Json): EvidenceSearchInput {
  const identity = (profile.identity ?? {}) as Record<string, string>;
  const category = String(identity.category ?? profile.category ?? "");
  const domain = inferDomainFromCategory(category) as IntelligenceDomain | "inferred";
  const presets = domain !== "inferred" ? presetsForDomain(domain as IntelligenceDomain) : [];
  const preset =
    presets.find((p) => p.match.test(identity.name || query) || p.match.test(category)) ?? presets[0];

  return {
    productId,
    productName: identity.name || query,
    brand: identity.brand,
    model: identity.model,
    variant: identity.variant,
    domain,
    productType: identity.subcategory || category,
    productSubtype: identity.variant || null,
    aliases: [query, identity.name].filter(Boolean) as string[],
    dimensions: preset?.dimensions?.slice(0, 8),
    buyerExpectations: Array.isArray(profile.bestFor) ? (profile.bestFor as string[]) : [],
    riskFactors: Array.isArray(profile.complaints) ? (profile.complaints as Array<{ text?: string }>).map((c) => c.text ?? "").filter(Boolean) : [],
    primaryUses: Array.isArray(profile.uses) ? (profile.uses as string[]) : [],
    evidenceTopics: planEvidenceQueries({
      productId,
      productName: identity.name || query,
      brand: identity.brand,
      domain,
      dimensions: preset?.dimensions,
    }).map((p) => p.query),
    country: "us",
  };
}

export async function enrichProfileWithConversationEvidence(
  productId: string,
  query: string,
  profile: Json,
  options?: { forceRefresh?: boolean; dimensions?: import("../blueprint/types.ts").BlueprintDimensionDef[] },
): Promise<Json> {
  const input = buildEvidenceSearchInputFromProfile(productId, query, profile);
  if (options?.dimensions) input.dimensions = options.dimensions;
  const gathered = await gatherConversationEvidence(input, {
    useCache: true,
    providers: ["youtube"],
    cache: redisEvidenceProviderCache,
    forceRefresh: options?.forceRefresh === true,
  });

  const conversationEvidence = gathered.items.map((item) => ({
    id: `${item.provider}:${item.sourceId}`,
    provider: item.provider,
    platform: item.platform,
    sourceId: item.sourceId,
    conversationId: item.conversationId,
    parentId: item.parentId,
    author: item.author ?? "",
    text: item.text,
    contextText: item.contextText,
    url: item.url ?? "",
    title: item.title ?? "",
    createdAt: item.createdAt,
    engagement: item.engagement,
    experienceQuality: item.experienceQuality,
  }));

  const existingVoices = Array.isArray(profile.voices) ? (profile.voices as Json[]) : [];
  const llmCandidates = gathered.items
    .filter((item) => item.experienceQuality.affectsScoring)
    .sort((a, b) => (b.engagement?.likes ?? 0) - (a.engagement?.likes ?? 0));
  const llmCap = YOUTUBE_LIMITS.maxLlmSample();
  const llmVoiceIds = new Set(existingVoices.map((v) => String(v.id)));
  const llmVoices = [...existingVoices];
  let llmAdded = 0;
  for (const item of llmCandidates) {
    const id = `${item.provider}-${item.sourceId}`;
    if (llmVoiceIds.has(id)) continue;
    if (llmAdded >= llmCap) break;
    llmVoiceIds.add(id);
    llmVoices.push({
      id,
      platform: item.platform,
      author: item.author ?? "Owner",
      text: item.text,
      url: item.url ?? "",
      where: item.title ? `on “${String(item.title).slice(0, 70)}”` : `via ${item.provider}`,
      date: item.createdAt ?? "",
      likes: item.engagement?.likes ?? 0,
      mark: "",
      stance: "mixed",
      topic: "",
      provider: item.provider,
      conversationId: item.conversationId,
      parentId: item.parentId,
      contextText: item.contextText,
      llmSample: true,
    });
    llmAdded += 1;
  }

  const counts: Record<string, number> = {};
  for (const item of gathered.items) {
    counts[item.platform] = (counts[item.platform] ?? 0) + 1;
  }

  return {
    ...profile,
    voices: llmVoices,
    conversationEvidence,
    evidenceProviderDiagnostics: gathered.diagnostics,
    evidencePlatformCounts: counts,
    evidenceQueries: gathered.queries,
    youtubeAcquisitionDiagnostics: gathered.youtubeAcquisition,
  };
}

/** Map gathered YouTube items to legacy OwnerComment shape for LLM investigate prompts. */
export function youtubeItemsToOwnerComments(
  items: Array<{ sourceId: string; author?: string; text: string; conversationId?: string; title?: string; createdAt?: string; engagement?: { likes?: number }; url?: string }>,
): Array<{
  id: string;
  author: string;
  avatar: string | null;
  text: string;
  likes: number;
  videoId: string;
  videoTitle: string;
  publishedAt: string;
}> {
  return items
    .filter((i) => i.text.length >= 45)
    .map((i) => ({
      id: i.sourceId,
      author: i.author ?? "YouTube viewer",
      avatar: null,
      text: i.text,
      likes: i.engagement?.likes ?? 0,
      videoId: i.conversationId ?? "",
      videoTitle: i.title ?? "",
      publishedAt: i.createdAt ?? "",
    }));
}

export async function gatherOwnerCommentsForInvestigate(
  productId: string,
  query: string,
  forceRefresh = false,
): Promise<
  Array<{
    id: string;
    author: string;
    avatar: string | null;
    text: string;
    likes: number;
    videoId: string;
    videoTitle: string;
    publishedAt: string;
  }>
> {
  const input: EvidenceSearchInput = {
    productId,
    productName: query,
    domain: "inferred",
    maxItems: 24,
  };
  const { items } = await gatherConversationEvidence(input, {
    useCache: true,
    providers: ["youtube"],
    cache: redisEvidenceProviderCache,
    forceRefresh,
  });
  const yt = items.filter((i) => i.provider === "youtube" && i.experienceQuality.affectsScoring);
  return youtubeItemsToOwnerComments(yt).slice(0, YOUTUBE_LIMITS.maxLlmSample());
}
