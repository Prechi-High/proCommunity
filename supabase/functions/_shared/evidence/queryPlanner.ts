import type { BlueprintDimensionDef } from "../blueprint/types.ts";
import type { IntelligenceDomain } from "../blueprint/types.ts";
import type { EvidenceSearchInput } from "./providers/types.ts";

export type PlannedQuery = {
  topic: string;
  query: string;
  source: "dimension" | "expectation" | "risk" | "use" | "alias" | "temporal";
};

function productPhrase(input: Pick<EvidenceSearchInput, "productName" | "brand" | "model" | "variant">): string {
  const parts = [input.brand, input.productName, input.model, input.variant].filter(Boolean);
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined.startsWith('"') ? joined : `"${joined}"`;
}

function dimTopic(dim: BlueprintDimensionDef): string {
  const label = dim.label.toLowerCase();
  const kw = dim.keywords.find((k) => k.length > 3) ?? dim.key.replace(/_/g, " ");
  return kw.length > 2 ? kw : label;
}

export function planEvidenceQueries(input: EvidenceSearchInput): PlannedQuery[] {
  const base = productPhrase(input);
  const out: PlannedQuery[] = [];
  const seen = new Set<string>();

  const add = (topic: string, suffix: string, source: PlannedQuery["source"]) => {
    const q = `${base} ${suffix}`.replace(/\s+/g, " ").trim();
    const key = q.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ topic, query: q, source });
  };

  for (const dim of input.dimensions ?? []) {
    add(dim.label, dimTopic(dim), "dimension");
  }

  for (const exp of input.buyerExpectations ?? []) {
    if (exp.length > 3) add("expectation", exp, "expectation");
  }
  for (const risk of input.riskFactors ?? []) {
    if (risk.length > 3) add("risk", risk, "risk");
  }
  for (const use of input.primaryUses ?? []) {
    if (use.length > 3) add("use", use, "use");
  }
  for (const alias of input.aliases ?? []) {
    if (alias.length > 3) add("alias", `"${alias}" experience`, "alias");
  }
  for (const topic of input.evidenceTopics ?? []) {
    if (topic.length > 2) add("topic", topic, "dimension");
  }

  const domain = input.domain;
  if (domain === "tech" || domain === "inferred") {
    add("longevity", "after 6 months", "temporal");
    add("problems", "problems", "risk");
    add("overheating", "overheating", "dimension");
    add("battery", "battery life", "dimension");
  } else if (domain === "beauty") {
    add("skin", "breakout", "risk");
    add("texture", "greasy", "dimension");
    add("weeks", "after weeks", "temporal");
    add("dry skin", "dry skin", "use");
  } else if (domain === "home-appliances") {
    add("reliability", "broke", "risk");
    add("noise", "noise", "dimension");
    add("year", "after one year", "temporal");
    add("repair", "repair", "risk");
  }

  if (!out.length) {
    add("review", "review", "dimension");
    add("owners", "owners experience", "use");
  }

  return out.slice(0, 24);
}

export function inferDomainFromCategory(category: string): IntelligenceDomain | "inferred" {
  const c = category.toLowerCase();
  if (/tech|phone|laptop|tablet|camera|gadget|electronics/.test(c)) return "tech";
  if (/beauty|skin|cosmetic|makeup|hair|grocery|food|supplement/.test(c)) return "beauty";
  if (/appliance|washer|dryer|fridge|kitchen|home/.test(c)) return "home-appliances";
  return "inferred";
}
