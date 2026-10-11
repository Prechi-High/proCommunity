import type { BlueprintDimensionDef } from "../blueprint/types.ts";
import type { IntelligenceDomain } from "../blueprint/types.ts";
import type { EvidenceSearchInput } from "./providers/types.ts";

export type QueryKind = "general" | "long_term" | "risk" | "dimension" | "usage" | "alias";

export type PlannedQuery = {
  topic: string;
  query: string;
  source: "dimension" | "expectation" | "risk" | "use" | "alias" | "temporal" | "general";
  kind: QueryKind;
  /** Higher = execute earlier when capped by MAX_YOUTUBE_SEARCH_QUERIES */
  priority: number;
  dimensionKey?: string;
};

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter((w) => w.length > 1);
}

/** Canonical quoted product phrase without duplicating brand tokens already in the product name. */
export function canonicalProductLabel(
  input: Pick<EvidenceSearchInput, "productName" | "brand" | "model" | "variant">,
): string {
  const brand = (input.brand ?? "").trim();
  let name = (input.productName ?? "").trim();
  const model = (input.model ?? "").trim();
  const variant = (input.variant ?? "").trim();

  if (brand) {
    const bLow = brand.toLowerCase();
    const nameLow = name.toLowerCase();
    if (nameLow === bLow) name = "";
    else if (nameLow.startsWith(`${bLow} `)) name = name.slice(brand.length).trim();
    else if (nameLow.startsWith(bLow)) name = name.slice(brand.length).trim();
  }

  const parts: string[] = [];
  if (brand) parts.push(brand);
  if (name) parts.push(name);
  if (model && !parts.join(" ").toLowerCase().includes(model.toLowerCase())) parts.push(model);
  if (variant && !parts.join(" ").toLowerCase().includes(variant.toLowerCase())) parts.push(variant);

  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return `"${(input.productName ?? "product").trim()}"`;
  return joined.includes('"') ? joined : `"${joined}"`;
}

function dimTopic(dim: BlueprintDimensionDef): string {
  const label = dim.label.toLowerCase();
  const kw = dim.keywords.find((k) => k.length > 3) ?? dim.key.replace(/_/g, " ");
  return kw.length > 2 ? kw : label;
}

function normalizeQueryKey(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

export function planEvidenceQueries(input: EvidenceSearchInput): PlannedQuery[] {
  const base = canonicalProductLabel(input);
  const out: PlannedQuery[] = [];
  const seen = new Set<string>();

  const add = (
    topic: string,
    suffix: string,
    source: PlannedQuery["source"],
    kind: QueryKind,
    priority: number,
    dimensionKey?: string,
  ) => {
    const q = suffix ? `${base} ${suffix}`.replace(/\s+/g, " ").trim() : base;
    const key = normalizeQueryKey(q);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ topic, query: q, source, kind, priority, dimensionKey });
  };

  add("product", "", "general", "general", 100);
  add("review", "review", "general", "general", 98);
  add("owner_review", "owner review", "general", "general", 96);

  for (const dim of input.dimensions ?? []) {
    const imp = dim.importance ?? 0.7;
    add(dim.label, dimTopic(dim), "dimension", "dimension", 70 + Math.round(imp * 20), dim.key);
  }

  for (const exp of input.buyerExpectations ?? []) {
    if (exp.length > 3) add("expectation", exp, "expectation", "usage", 55);
  }
  for (const risk of input.riskFactors ?? []) {
    if (risk.length > 3) add("risk", risk, "risk", "risk", 65);
  }
  for (const use of input.primaryUses ?? []) {
    if (use.length > 3) add("use", use, "use", "usage", 50);
  }
  for (const alias of input.aliases ?? []) {
    const clean = alias.replace(/^["']|["']$/g, "").trim();
    if (clean.length > 3 && !tokenize(base).every((t) => tokenize(clean).includes(t))) {
      add("alias", `"${clean}" experience`, "alias", "alias", 45);
    }
  }

  const domain = input.domain;
  if (domain === "tech" || domain === "inferred") {
    add("longevity", "after 6 months", "temporal", "long_term", 88);
    add("long_term", "long term", "temporal", "long_term", 86);
    add("problems", "problems", "risk", "risk", 82);
    add("overheating", "overheating", "dimension", "dimension", 75, "heat_management");
    add("battery", "battery life", "dimension", "dimension", 78, "battery_endurance");
  } else if (domain === "beauty") {
    add("longevity", "after months", "temporal", "long_term", 88);
    add("long_term", "long term", "temporal", "long_term", 86);
    add("skin", "breakout", "risk", "risk", 80);
    add("texture", "greasy", "dimension", "dimension", 76, "absorption");
    add("weeks", "after weeks", "temporal", "long_term", 84);
    add("dry skin", "dry skin", "use", "usage", 52);
    add("irritation", "irritation", "dimension", "dimension", 74, "irritation");
  } else if (domain === "home-appliances") {
    add("longevity", "after one year", "temporal", "long_term", 88);
    add("reliability", "broke", "risk", "risk", 82);
    add("noise", "noise", "dimension", "dimension", 76, "noise");
    add("repair", "repair", "risk", "risk", 70);
    add("problems", "problems", "risk", "risk", 80);
  }

  if (!out.some((p) => p.kind === "general")) {
    add("review", "review", "general", "general", 90);
    add("owners", "owners experience", "use", "usage", 48);
  }

  return out;
}

/** Rank and cap queries for YouTube search execution (deduped). */
export function selectYoutubeSearchQueries(planned: PlannedQuery[], maxQueries: number): PlannedQuery[] {
  const sorted = [...planned].sort((a, b) => b.priority - a.priority);
  const out: PlannedQuery[] = [];
  const seen = new Set<string>();
  for (const p of sorted) {
    const key = normalizeQueryKey(p.query);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= maxQueries) break;
  }
  return out;
}

/** Follow-up queries targeting weak dimension keys. */
export function planDimensionTargetedQueries(
  input: EvidenceSearchInput,
  weakDimensionKeys: string[],
): PlannedQuery[] {
  const base = canonicalProductLabel(input);
  const dims = input.dimensions ?? [];
  const out: PlannedQuery[] = [];
  const seen = new Set<string>();
  for (const key of weakDimensionKeys) {
    const dim = dims.find((d) => d.key === key);
    if (!dim) continue;
    const suffix = dimTopic(dim);
    const q = `${base} ${suffix}`.replace(/\s+/g, " ").trim();
    const nk = normalizeQueryKey(q);
    if (seen.has(nk)) continue;
    seen.add(nk);
    out.push({
      topic: dim.label,
      query: q,
      source: "dimension",
      kind: "dimension",
      priority: 95,
      dimensionKey: key,
    });
  }
  return out;
}

export function inferDomainFromCategory(category: string): IntelligenceDomain | "inferred" {
  const c = category.toLowerCase();
  if (/tech|phone|laptop|tablet|camera|gadget|electronics|smartphone/.test(c)) return "tech";
  if (/beauty|skin|cosmetic|makeup|hair|grocery|food|supplement|moistur/.test(c)) return "beauty";
  if (/appliance|washer|dryer|fridge|kitchen|home|air fryer/.test(c)) return "home-appliances";
  return "inferred";
}
