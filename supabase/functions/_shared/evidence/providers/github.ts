import { GITHUB_TOKEN, PROVIDER_CAPS, PROVIDER_ENABLED, PROVIDER_TIMEOUT_MS } from "./config.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult, RawEvidence } from "./types.ts";

const DEV_PRODUCT_RE =
  /\b(software|sdk|api|firmware|developer|open[- ]?source|github|repo|library|framework|plugin|app)\b/i;

export const githubProvider: EvidenceProvider = {
  id: "github",

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.github) return { provider: "github", status: "disabled", items: [] };
    const hay = `${input.productType ?? ""} ${input.productName} ${input.domain}`.toLowerCase();
    if (input.domain === "beauty" || input.domain === "home-appliances") {
      if (!DEV_PRODUCT_RE.test(hay)) return { provider: "github", status: "skipped", items: [] };
    }
    const q = `${input.brand ?? ""} ${input.productName}`.trim();
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}+is:public&per_page=10`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
      if (!res.ok) return { provider: "github", status: "error", items: [], error: `http_${res.status}` };
      const json = (await res.json()) as { items?: Array<{ id: number; title: string; body?: string; html_url: string; user?: { login?: string }; created_at?: string }> };
      const cap = Math.min(PROVIDER_CAPS.github, input.maxItems ?? PROVIDER_CAPS.github);
      const items: RawEvidence[] = [];
      for (const issue of json.items ?? []) {
        const text = `${issue.title}. ${(issue.body ?? "").slice(0, 600)}`.replace(/\s+/g, " ").trim();
        if (text.length < 50) continue;
        items.push({
          provider: "github",
          platform: "github",
          sourceId: String(issue.id),
          author: issue.user?.login,
          text,
          url: issue.html_url,
          createdAt: issue.created_at,
          rawMetadata: { kind: "issue" },
        });
        if (items.length >= cap) break;
      }
      return { provider: "github", status: "ok", items };
    } catch (e) {
      return { provider: "github", status: "error", items: [], error: String(e) };
    }
  },
};
