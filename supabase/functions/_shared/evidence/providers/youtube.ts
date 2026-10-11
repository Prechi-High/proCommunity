import { PROVIDER_ENABLED } from "./config.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult } from "./types.ts";
import { secret } from "./config.ts";
import { harvestYoutubeEvidence } from "./youtube/harvest.ts";
import type { YoutubeAcquisitionDiagnostics } from "./youtube/diagnostics.ts";

export type { YoutubeAcquisitionDiagnostics };

export const youtubeProvider: EvidenceProvider = {
  id: "youtube",

  async healthCheck() {
    return { ok: Boolean(secret("YOUTUBE_DATA_API_KEY")) };
  },

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.youtube) return { provider: "youtube", status: "disabled", items: [] };

    const ext = input as EvidenceSearchInput & {
      forceRefresh?: boolean;
      cacheStore?: import("../gatherConversationEvidence.ts").EvidenceProviderCacheStore;
    };

    try {
      const { items, diagnostics } = await harvestYoutubeEvidence({
        ...input,
        forceRefresh: ext.forceRefresh,
        cacheStore: ext.cacheStore,
      });
      return {
        provider: "youtube",
        status: "ok",
        items,
        requestsUsed: diagnostics.requestsUsed,
        acquisition: diagnostics,
      };
    } catch (e) {
      return { provider: "youtube", status: "error", items: [], error: String(e) };
    }
  },
};
