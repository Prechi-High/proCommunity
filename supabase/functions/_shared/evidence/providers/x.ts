import { PROVIDER_CAPS, PROVIDER_ENABLED, X_PROVIDER } from "./config.ts";
import { restProviderSearch } from "./restAdapter.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult } from "./types.ts";

export const xProvider: EvidenceProvider = {
  id: "x",

  async healthCheck() {
    if (!PROVIDER_ENABLED.x) return { ok: false, reason: "disabled" };
    if (!X_PROVIDER.baseUrl) return { ok: false, reason: "missing_base_url" };
    return { ok: true };
  },

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.x) return { provider: "x", status: "disabled", items: [] };
    if (!X_PROVIDER.baseUrl) return { provider: "x", status: "disabled", items: [] };
    try {
      const phrase = `"${[input.brand, input.productName].filter(Boolean).join(" ").trim()}"`;
      const items = await restProviderSearch("x", X_PROVIDER.baseUrl, X_PROVIDER.apiKey, {
        query: phrase,
        productName: input.productName,
        brand: input.brand,
        maxItems: Math.min(PROVIDER_CAPS.x, input.maxItems ?? PROVIDER_CAPS.x),
      });
      return { provider: "x", status: "ok", items, requestsUsed: 1 };
    } catch (e) {
      return { provider: "x", status: "error", items: [], error: String(e) };
    }
  },
};
