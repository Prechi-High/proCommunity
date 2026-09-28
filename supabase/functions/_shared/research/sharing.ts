/**
 * Share-safe projection of a Research Card. The database function `research_card_by_share`
 * already returns only public fields; this whitelist is a second, code-level guarantee.
 */

type J = Record<string, unknown>;

const PUBLIC_SECTIONS = new Set(["identity", "summary", "confidence", "key_facts", "ingredients_or_specs", "community", "pros_cons", "pricing", "stores", "alternatives", "sources"]);

export type PublicCard = {
  reference: string;
  title: string;
  status: string;
  imageUrl: string | null;
  createdAt: string | null;
  products: Array<{ name: string; brand: string; category: string; image: string | null; role: string }>;
  sections: Array<{ key: string; title: string; content: J }>;
  comparisons: Array<{ snapshot: J | null }>;
  sources: Array<{ name: string; url: string | null; type: string }>;
};

const s = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);

function scrubCommunity(content: J): J {
  return {
    consensus: s(content.consensus, 400),
    people: content.people ?? null,
    voices: list(content.voices).map((v) => ({ platform: s(v.platform, 12), stance: s(v.stance, 8), text: s(v.text, 320), url: s(v.url, 400) || null })),
  };
}

export function toPublicCard(raw: J | null): PublicCard | null {
  if (!raw || typeof raw !== "object" || !raw.reference) return null;
  return {
    reference: s(raw.reference, 20),
    title: s(raw.title, 160),
    status: s(raw.status, 20),
    imageUrl: s(raw.imageUrl, 500) || null,
    createdAt: s(raw.createdAt, 40) || null,
    products: list(raw.products).map((p) => ({ name: s(p.name, 160), brand: s(p.brand, 80), category: s(p.category, 80), image: s(p.image, 500) || null, role: s(p.role, 20) })),
    sections: list(raw.sections)
      .filter((x) => PUBLIC_SECTIONS.has(s(x.key, 40)))
      .map((x) => ({ key: s(x.key, 40), title: s(x.title, 80), content: s(x.key) === "community" ? scrubCommunity((x.content ?? {}) as J) : ((x.content ?? {}) as J) })),
    comparisons: list(raw.comparisons).map((c) => ({ snapshot: (c.snapshot ?? null) as J | null })),
    sources: list(raw.sources).slice(0, 30).map((x) => ({ name: s(x.name, 80), url: s(x.url, 500) || null, type: s(x.type, 20) })),
  };
}

export function ogFor(card: PublicCard): { title: string; description: string; image: string | null } {
  const summary = card.sections.find((x) => x.key === "summary")?.content as J | undefined;
  const text = s(summary?.verdict, 200) || s(summary?.summary, 200) || "Independent product research from real owners and cited sources.";
  return { title: `${card.title || "Product research"} · Sourced research`, description: text, image: card.imageUrl ?? card.products[0]?.image ?? null };
}
