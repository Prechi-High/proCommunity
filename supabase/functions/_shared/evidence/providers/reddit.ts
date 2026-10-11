import { PROVIDER_CAPS, PROVIDER_ENABLED, REDDIT_PROVIDER } from "./config.ts";
import { restProviderSearch } from "./restAdapter.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult } from "./types.ts";

export const redditProvider: EvidenceProvider = {
  id: "reddit",

  async healthCheck() {
    if (!PROVIDER_ENABLED.reddit) return { ok: false, reason: "disabled" };
    if (!REDDIT_PROVIDER.baseUrl) return { ok: false, reason: "missing_base_url" };
    return { ok: true };
  },

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.reddit) return { provider: "reddit", status: "disabled", items: [] };
    if (!REDDIT_PROVIDER.baseUrl) return { provider: "reddit", status: "disabled", items: [] };
    try {
      const items = await restProviderSearch("reddit", REDDIT_PROVIDER.baseUrl, REDDIT_PROVIDER.apiKey, {
        query: `${input.brand ?? ""} ${input.productName}`.trim(),
        productName: input.productName,
        brand: input.brand,
        maxItems: Math.min(PROVIDER_CAPS.reddit, input.maxItems ?? PROVIDER_CAPS.reddit),
      });
      return { provider: "reddit", status: "ok", items, requestsUsed: 1 };
    } catch (e) {
      return { provider: "reddit", status: "error", items: [], error: String(e) };
    }
  },
};
