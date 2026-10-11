import { DISCOURSE_ALLOWLIST, PROVIDER_CAPS, PROVIDER_ENABLED, PROVIDER_TIMEOUT_MS } from "./config.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult, RawEvidence } from "./types.ts";

async function searchDiscourseSite(base: string, q: string, max: number): Promise<RawEvidence[]> {
  const url = `${base.replace(/\/$/, "")}/search.json?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    posts?: Array<{
      id: number;
      topic_id: number;
      username?: string;
      cooked?: string;
      created_at?: string;
      post_number?: number;
    }>;
  };
  const items: RawEvidence[] = [];
  for (const p of json.posts ?? []) {
    const text = (p.cooked ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length < 40) continue;
    items.push({
      provider: "discourse",
      platform: "forum",
      sourceId: String(p.id),
      conversationId: String(p.topic_id),
      author: p.username,
      text,
      url: `${base}/t/topic/${p.topic_id}/${p.post_number ?? 1}`,
      createdAt: p.created_at,
      rawMetadata: { discourseHost: base },
    });
    if (items.length >= max) break;
  }
  return items;
}

export const discourseProvider: EvidenceProvider = {
  id: "discourse",

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.discourse) return { provider: "discourse", status: "disabled", items: [] };
    const hosts = DISCOURSE_ALLOWLIST;
    if (!hosts.length) return { provider: "discourse", status: "disabled", items: [] };
    const q = `${input.brand ?? ""} ${input.productName}`.trim();
    const cap = Math.min(PROVIDER_CAPS.discourse, input.maxItems ?? PROVIDER_CAPS.discourse);
    const perHost = Math.max(3, Math.ceil(cap / hosts.length));
    const batches = await Promise.allSettled(hosts.map((h) => searchDiscourseSite(`https://${h}`, q, perHost)));
    const items: RawEvidence[] = [];
    for (const b of batches) {
      if (b.status === "fulfilled") items.push(...b.value);
    }
    return { provider: "discourse", status: "ok", items: items.slice(0, cap) };
  },
};
