import type { ProductProfile } from "../core/intelligence.ts";
import type { CardStatus, Focus, ResearchSection, ResearchSnapshot, ResearchSource } from "./types.ts";

/**
 * Turns an existing Product Intelligence profile into Research Card sections.
 * Category-aware labels (ingredients vs specs vs materials); nothing is invented —
 * a section with no evidence is marked unavailable and hidden by every interface.
 */

type J = Record<string, unknown>;
const arr = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const s = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function specsLabel(category: string): { key: string; title: string } {
  const c = category.toLowerCase();
  if (/skin|beauty|cosmetic|hair|serum|cream|lotion|cleanser|makeup|fragrance|food|snack|drink|supplement|vitamin|protein|grocery/.test(c)) {
    return { key: "ingredients_or_specs", title: "Ingredients" };
  }
  if (/shoe|sneaker|cloth|shirt|dress|bag|fashion|jacket|apparel|wear|jewel/.test(c)) return { key: "ingredients_or_specs", title: "Materials & fit" };
  return { key: "ingredients_or_specs", title: "Specs" };
}

const ORDER = ["identity", "summary", "confidence", "key_facts", "fit", "ingredients_or_specs", "community", "pros_cons", "pricing", "stores", "alternatives", "sources"];

const FOCUS_SECTIONS: Record<Focus, string[]> = {
  everything: ORDER,
  fit: ["identity", "summary", "fit", "confidence", "community", "sources"],
  ingredients: ["identity", "summary", "ingredients_or_specs", "sources"],
  community: ["identity", "summary", "community", "pros_cons", "sources"],
  price: ["identity", "summary", "pricing", "stores", "sources"],
  stores: ["identity", "summary", "stores", "pricing", "sources"],
  alternatives: ["identity", "summary", "alternatives", "sources"],
  comparison: ORDER,
};

function section(key: string, title: string, content: J, ready: boolean): ResearchSection {
  return { section_key: key, title, content, status: ready ? "ready" : "unavailable", display_order: ORDER.indexOf(key) };
}

export function confidenceExplanation(p: ProductProfile): J {
  const people = (p.people ?? {}) as J;
  const voices = n(people.voices) ?? arr(p.voices).length;
  const ratings = n(p.ratingCount) ?? 0;
  const sources = arr(p.sources).length;
  const drivers: string[] = [];
  if (voices) drivers.push(`${voices} owner ${voices === 1 ? "voice" : "voices"} from reviews, videos and forums`);
  if (ratings) drivers.push(`${ratings.toLocaleString("en")} store ratings${n(p.rating) ? ` averaging ${n(p.rating)}/5` : ""}`);
  if (sources) drivers.push(`${sources} cited ${sources === 1 ? "source" : "sources"}`);
  const uncertainty: string[] = [];
  if (voices < 5) uncertainty.push("Few owners have spoken about it yet, so this can shift as more people report back.");
  if (p.band === "Uncertain") uncertainty.push("We aren't fully sure this is the exact variant — check the name and size before buying.");
  if (!arr(p.complaints).length) uncertainty.push("No recurring complaints surfaced, which may just mean limited coverage.");
  return {
    score: n(p.score),
    identityConfidence: n(p.confidence),
    band: s(p.band, 20) || null,
    drivers,
    uncertainty,
    note: "This score summarises what owners and sources report. It is not a guarantee of safety, results or suitability for you.",
  };
}

export function buildSections(profile: ProductProfile, focus: Focus): {
  sections: ResearchSection[];
  sources: ResearchSource[];
  snapshots: Array<Omit<ResearchSnapshot, "research_card_id">>;
  status: CardStatus;
  title: string;
} {
  const id = (profile.identity ?? {}) as J;
  const category = s(id.category, 80);
  const name = s(id.name, 160) || s(profile.query, 160);
  const brand = s(id.brand, 80);
  const spec = specsLabel(category);
  const people = (profile.people ?? {}) as J;
  const voices = arr(profile.voices);
  const praise = arr(profile.praise).map((c) => ({ text: s(c.text, 240), source: n(c.source) }));
  const complaints = arr(profile.complaints).map((c) => ({ text: s(c.text, 240), source: n(c.source) }));
  const offers = arr(profile.offers).slice(0, 8).map((o) => ({ seller: s(o.seller, 80), price: o.price ?? null, link: s(o.link, 500) || null, rating: n(o.rating) }));
  const priceRange = (profile.priceRange ?? null) as J | null;

  const all: ResearchSection[] = [
    section("identity", "Product", {
      name,
      brand,
      model: s(id.model, 80),
      variant: s(id.variant, 80),
      size: s(id.size, 40),
      category,
      image: arr(profile.images)[0] ?? null,
    }, Boolean(name)),
    section("summary", "Quick summary", { summary: s(profile.summary, 900), verdict: s(profile.verdict, 400), consensus: s(profile.consensus, 400) }, Boolean(s(profile.summary) || s(profile.verdict))),
    section("confidence", "How sure we are", confidenceExplanation(profile), n(profile.score) != null),
    section("key_facts", "What the box won't tell you", { facts: arr(profile.reveals).slice(0, 6).map((r) => s(r.text, 240)) }, arr(profile.reveals).length > 0),
    section("fit", "Who it suits", { bestFor: profile.bestFor ?? [], notFor: profile.notFor ?? [], uses: profile.uses ?? [], howToUse: s(profile.howToUse, 600) }, arr(profile.bestFor).length + arr(profile.notFor).length > 0),
    section(spec.key, spec.title, { rows: arr(profile.specs).slice(0, 24).map((r) => ({ label: s(r.label, 60), value: s(r.value, 240), source: n(r.source) })) }, arr(profile.specs).length > 0),
    section("community", "What owners say", {
      consensus: s(profile.consensus, 400),
      people: { voices: n(people.voices) ?? voices.length, ratings: n(people.ratings), discussions: n(people.discussions) },
      voices: voices.slice(0, 8).map((v) => ({ author: s(v.author, 60), platform: s(v.platform, 12), stance: s(v.stance, 8), text: s(v.text, 320), url: s(v.url, 400) || null })),
    }, voices.length > 0 || Boolean(s(profile.consensus))),
    section("pros_cons", "Praise & complaints", { praise, complaints }, praise.length + complaints.length > 0),
    section("pricing", "Price", { range: priceRange, rating: n(profile.rating), ratingCount: n(profile.ratingCount) }, Boolean(priceRange)),
    section("stores", "Where to buy", { offers }, offers.length > 0),
    section("alternatives", "Alternatives", { items: arr(profile.alternatives).slice(0, 6).map((a) => ({ name: s(a.name, 120), reason: s(a.reason, 240) })) }, arr(profile.alternatives).length > 0),
    section("sources", "Sources", { items: arr(profile.sources).slice(0, 20).map((x) => ({ n: n(x.n), title: s(x.title, 160), url: s(x.url, 500), domain: s(x.domain, 80), kind: s(x.kind, 20) })) }, arr(profile.sources).length > 0),
  ];

  const wanted = new Set(FOCUS_SECTIONS[focus] ?? ORDER);
  const sections = all.filter((x) => wanted.has(x.section_key));
  const core = sections.filter((x) => ["summary", "community", "pros_cons"].includes(x.section_key));
  const status: CardStatus = !sections.some((x) => x.status === "ready" && x.section_key !== "identity")
    ? "failed"
    : core.some((x) => x.status === "unavailable")
      ? "partial"
      : "complete";

  const sources: ResearchSource[] = arr(profile.sources).slice(0, 30).map((x) => ({
    section_key: null,
    source_type: s(x.kind, 20) || "web",
    source_name: s(x.domain, 80) || s(x.title, 80),
    source_url: s(x.url, 500) || null,
    source_reference: n(x.n) != null ? String(n(x.n)) : null,
    metadata: { title: s(x.title, 160) },
  }));
  for (const v of voices.slice(0, 12)) {
    sources.push({ section_key: "community", source_type: s(v.platform, 12) || "community", source_name: s(v.author, 60), source_url: s(v.url, 400) || null, source_reference: s(v.id, 40) || null });
  }

  const version = s(profile.verifiedAt, 40) || null;
  const snapshots: Array<Omit<ResearchSnapshot, "research_card_id">> = [
    { snapshot_type: "product", data: { name, brand, category, variant: s(id.variant, 80), image: arr(profile.images)[0] ?? null }, source_version: version },
    { snapshot_type: "confidence", data: confidenceExplanation(profile), source_version: version },
    { snapshot_type: "community", data: { consensus: s(profile.consensus, 400), voices: voices.length, praise: praise.length, complaints: complaints.length }, source_version: version },
  ];
  if (priceRange) snapshots.push({ snapshot_type: "price", data: { ...priceRange, offers: offers.length }, source_version: version });
  if (offers.length) snapshots.push({ snapshot_type: "availability", data: { sellers: offers.map((o) => o.seller).slice(0, 8) }, source_version: version });

  return { sections, sources, snapshots, status, title: [brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? brand : "", name].filter(Boolean).join(" ") };
}

export const STATUS_LABEL: Record<CardStatus, string> = {
  created: "Preparing research…",
  identifying: "Identifying product…",
  researching: "Researching…",
  partial: "Some sections unavailable",
  complete: "Research ready",
  failed: "Research couldn't be completed",
  archived: "Archived",
};
