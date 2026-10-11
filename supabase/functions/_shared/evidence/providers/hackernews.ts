import { PROVIDER_CAPS, PROVIDER_ENABLED, PROVIDER_TIMEOUT_MS } from "./config.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult, RawEvidence } from "./types.ts";

export const hackernewsProvider: EvidenceProvider = {
  id: "hackernews",

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.hackernews) return { provider: "hackernews", status: "disabled", items: [] };
    if (input.domain === "beauty" || input.domain === "home-appliances") {
      return { provider: "hackernews", status: "skipped", items: [] };
    }
    const q = `${input.brand ?? ""} ${input.productName}`.trim();
    try {
      const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=15`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
      if (!res.ok) return { provider: "hackernews", status: "error", items: [], error: `http_${res.status}` };
      const json = (await res.json()) as {
        hits?: Array<{ objectID: string; comment_text?: string; author?: string; created_at?: string; story_url?: string; parent_id?: number }>;
      };
      const cap = Math.min(PROVIDER_CAPS.hackernews, input.maxItems ?? PROVIDER_CAPS.hackernews);
      const items: RawEvidence[] = [];
      for (const hit of json.hits ?? []) {
        const text = (hit.comment_text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (text.length < 40) continue;
        items.push({
          provider: "hackernews",
          platform: "hackernews",
          sourceId: hit.objectID,
          parentId: hit.parent_id ? String(hit.parent_id) : undefined,
          author: hit.author,
          text,
          url: hit.story_url,
          createdAt: hit.created_at,
        });
        if (items.length >= cap) break;
      }
      return { provider: "hackernews", status: "ok", items };
    } catch (e) {
      return { provider: "hackernews", status: "error", items: [], error: String(e) };
    }
  },
};
