import { PROVIDER_TIMEOUT_MS } from "./config.ts";
import type { RawEvidence } from "./types.ts";

type RestSearchBody = {
  query: string;
  productName?: string;
  brand?: string;
  maxItems?: number;
};

/** Generic REST adapter for swappable Reddit/X providers. */
export async function restProviderSearch(
  provider: "reddit" | "x",
  baseUrl: string,
  apiKey: string,
  body: RestSearchBody,
): Promise<RawEvidence[]> {
  if (!baseUrl) return [];
  const url = `${baseUrl.replace(/\/$/, "")}/search`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } : {}),
      },
      body: JSON.stringify({ ...body, provider }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items?: Array<{
        id: string;
        text: string;
        author?: string;
        url?: string;
        platform?: string;
        conversationId?: string;
        parentId?: string;
        contextText?: string;
        createdAt?: string;
        title?: string;
        engagement?: { likes?: number; replies?: number };
      }>;
    };
    const platform = provider === "reddit" ? "reddit" : "x";
    return (json.items ?? []).map((item) => ({
      provider,
      platform: item.platform ?? platform,
      sourceId: item.id,
      conversationId: item.conversationId,
      parentId: item.parentId,
      author: item.author,
      text: item.text,
      title: item.title,
      url: item.url,
      createdAt: item.createdAt,
      engagement: item.engagement,
      contextText: item.contextText,
      rawMetadata: { adapter: "rest" },
    }));
  } finally {
    clearTimeout(timer);
  }
}
