import { PROVIDER_CAPS, PROVIDER_ENABLED, PROVIDER_TIMEOUT_MS, secret } from "./config.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult, RawEvidence } from "./types.ts";

/** Serper-backed discovery / fallback snippets — not primary conversation source. */
export const webEvidenceProvider: EvidenceProvider = {
  id: "web",

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.web) return { provider: "web", status: "disabled", items: [] };
    const key = secret("SERPER_API_KEY");
    if (!key) return { provider: "web", status: "disabled", items: [] };
    const q = `${input.brand ?? ""} ${input.productName} review owners experience`.trim();
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 8 }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
      if (!res.ok) return { provider: "web", status: "error", items: [], error: `http_${res.status}` };
      const json = (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
      const cap = Math.min(PROVIDER_CAPS.web, input.maxItems ?? PROVIDER_CAPS.web);
      const items: RawEvidence[] = [];
      for (const [i, row] of (json.organic ?? []).entries()) {
        const text = String(row.snippet ?? "").trim();
        if (text.length < 40) continue;
        items.push({
          provider: "web",
          platform: "web",
          sourceId: `serper_${i}`,
          text,
          title: row.title,
          url: row.link,
          rawMetadata: { discovery: true },
        });
        if (items.length >= cap) break;
      }
      return { provider: "web", status: "ok", items, requestsUsed: 1 };
    } catch (e) {
      return { provider: "web", status: "error", items: [], error: String(e) };
    }
  },
};
