import { callLlmJson } from "../core/llmChat.ts";
import type { DomainResolution } from "../domain/types.ts";
import { validateBlueprintDimensions } from "./validate.ts";
import { inferDomainFromProductType, validateDimensionSemantics } from "../evidence/validateDimensions.ts";
import type {
  BlueprintDimensionDef,
  BlueprintFactSectionDef,
  IntelligenceDomain,
  ProductClassification,
} from "./types.ts";

export type LlmBlueprintJson = {
  domain: string;
  product_family: string;
  product_type: string;
  product_subtype?: string | null;
  primary_uses: string[];
  buyer_expectations: string[];
  risk_factors: string[];
  fact_sections: Array<{ key: string; label: string; renderer: string }>;
  fact_field_candidates: string[];
  dimensions: Array<{
    key: string;
    label: string;
    importance?: number;
    why_it_matters?: string;
    keywords?: string[];
  }>;
  secondary_dimensions?: Array<{
    key: string;
    label: string;
    importance?: number;
    why_it_matters?: string;
    keywords?: string[];
  }>;
  research_requirements?: Array<{ target: string; questions: string[] }>;
  excluded_examples?: string[];
};

const DOMAIN_MAP: Record<IntelligenceDomain, { categoryId: string; templateId: string }> = {
  tech: { categoryId: "domain_tech", templateId: "tpl_domain_tech" },
  beauty: { categoryId: "domain_beauty", templateId: "tpl_domain_beauty" },
  "home-appliances": { categoryId: "domain_home_appliances", templateId: "tpl_domain_home" },
};

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function normalizeDomain(raw: string, domainResolution?: DomainResolution): IntelligenceDomain {
  const d = raw.toLowerCase().replace(/\s+/g, "-");
  if (d.includes("beauty") || d.includes("cosmetic")) return "beauty";
  if (d.includes("home") || d.includes("appliance") || d.includes("kitchen")) return "home-appliances";
  if (d.includes("tech") || d.includes("electronic")) return "tech";
  const resolved = domainResolution?.domain?.toLowerCase() ?? "";
  if (resolved.includes("beauty")) return "beauty";
  if (resolved.includes("home") || resolved.includes("appliance")) return "home-appliances";
  if (resolved.includes("tech")) return "tech";
  if (resolved.includes("sport") || resolved.includes("outdoor") || resolved.includes("cycl")) return "tech";
  if (resolved.includes("auto")) return "tech";
  return "tech";
}

function keywordsForDimension(key: string, label: string, extra?: string[]): string[] {
  const base = [
    ...key.split("_").filter((p) => p.length > 2),
    ...label.toLowerCase().split(/\s+/).filter((p) => p.length > 2),
    ...(extra ?? []),
  ];
  return Array.from(new Set(base.map((k) => k.toLowerCase()))).slice(0, 12);
}

function mapFactSections(json: LlmBlueprintJson): BlueprintFactSectionDef[] {
  const candidates = json.fact_field_candidates ?? [];
  return (json.fact_sections ?? []).slice(0, 6).map((s) => ({
    key: str(s.key, 40) || "details",
    label: str(s.label, 80) || "Details",
    renderer: str(s.renderer, 40) || "key_value_list",
    fieldKeys: candidates.slice(0, 16),
  }));
}

function mapDimensions(
  primary: LlmBlueprintJson["dimensions"],
  secondary: LlmBlueprintJson["secondary_dimensions"],
  domain: IntelligenceDomain,
  productType: string,
  domainName?: string,
): BlueprintDimensionDef[] {
  const all = [...(primary ?? []), ...(secondary ?? [])].slice(0, 12);
  let dims: BlueprintDimensionDef[] = all.map((d) => ({
    key: str(d.key, 40),
    label: str(d.label, 80),
    importance: typeof d.importance === "number" ? Math.min(1, Math.max(0.1, d.importance)) : 0.75,
    keywords: keywordsForDimension(str(d.key, 40), str(d.label, 80), d.keywords),
    whyItMatters: d.why_it_matters ? str(d.why_it_matters, 300) : undefined,
  }));
  dims = dims.filter((d) => d.key && d.label);
  const validation = validateBlueprintDimensions(domain, dims.map((d) => d.key));
  if (!validation.ok) dims = dims.filter((d) => !validation.rejected.includes(d.key));
  const sem = validateDimensionSemantics(
    inferDomainFromProductType(productType, domainName),
    productType,
    dims.map((d) => ({ key: d.key, label: d.label })),
  );
  if (!sem.ok) dims = dims.filter((d) => !sem.rejected.includes(d.key));
  const primaryOnly = dims.slice(0, 7);
  return primaryOnly.length >= 4 ? primaryOnly : dims.slice(0, Math.max(4, primaryOnly.length));
}

export function parseLlmBlueprintPayload(data: Record<string, unknown>): LlmBlueprintJson | null {
  if (!data || typeof data !== "object") return null;
  const dimensions = Array.isArray(data.dimensions) ? data.dimensions : [];
  if (!dimensions.length) return null;
  return data as LlmBlueprintJson;
}

export function classificationFromLlm(
  json: LlmBlueprintJson,
  domainResolution?: DomainResolution,
): ProductClassification {
  const domain = normalizeDomain(str(json.domain, 40), domainResolution);
  const meta = DOMAIN_MAP[domain];
  return {
    domain,
    categoryId: meta.categoryId,
    templateId: meta.templateId,
    productType: str(json.product_type, 60) || "general",
    productSubtype: json.product_subtype ? str(json.product_subtype, 60) : null,
    classificationConfidence: domainResolution?.classificationConfidence ?? 0.72,
    primaryUses: (json.primary_uses ?? []).map((u) => str(u, 80)).filter(Boolean).slice(0, 8),
    buyerExpectations: (json.buyer_expectations ?? []).map((u) => str(u, 120)).filter(Boolean).slice(0, 8),
    riskFactors: (json.risk_factors ?? []).map((u) => str(u, 120)).filter(Boolean).slice(0, 8),
  };
}

export async function generateProductBlueprintLlm(input: {
  productId: string;
  query: string;
  identity: { name?: string; brand?: string; category?: string; subcategory?: string };
  summary?: string;
  specs?: Array<{ label?: string; value?: string }>;
  domainResolution?: DomainResolution;
}): Promise<{ json: LlmBlueprintJson; model: string | null; classification: ProductClassification; factSections: BlueprintFactSectionDef[]; dimensions: BlueprintDimensionDef[] }> {
  const identityBlock = JSON.stringify({
    name: input.identity.name ?? "",
    brand: input.identity.brand ?? "",
    category: input.identity.category ?? "",
    subcategory: input.identity.subcategory ?? "",
    query: input.query,
    summary: input.summary ?? "",
    specs: (input.specs ?? []).slice(0, 12),
    resolved_domain: input.domainResolution?.domain ?? null,
    product_family_hint: input.domainResolution?.productFamily ?? null,
    product_type_hint: input.domainResolution?.productType ?? null,
  });

  const prompt = `You are the Unmask Product Blueprint Generator.
Design a product-specific intelligence blueprint for ONE consumer product.
Return JSON only matching this schema:
{
  "domain": "tech|beauty|home-appliances|inferred",
  "product_family": "string",
  "product_type": "string",
  "product_subtype": "string|null",
  "primary_uses": ["..."],
  "buyer_expectations": ["..."],
  "risk_factors": ["..."],
  "fact_sections": [{"key":"...","label":"Specs|Ingredients|Materials|Details|...","renderer":"fact_grid|ingredient_list|key_value_list|grouped_facts"}],
  "fact_field_candidates": ["field keys relevant to this exact product"],
  "dimensions": [{"key":"snake_case","label":"Human label","importance":0.0-1.0,"why_it_matters":"...","keywords":["..."]}],
  "secondary_dimensions": [{"key":"...","label":"...","importance":0.5}],
  "research_requirements": [{"target":"dimension_or_fact_key","questions":["..."]}],
  "excluded_examples": ["irrelevant dimension keys for this product type"]
}

Rules:
- 4-7 primary dimensions in "dimensions"; up to 5 optional in "secondary_dimensions".
- Never include smartphone dimensions (camera, battery) on beauty/home products unless the product truly has them.
- For inferred domains (e.g. mountain bike), invent appropriate experience dimensions (handling, braking, comfort) — do not default to tech phone dimensions.
- factual sections must match product type (foundation → Ingredients + Product Details; air fryer → Specs; lipstick → Ingredients + Product Details).
- Evaluation dimensions must be user-experience outcomes (e.g. comfort, effectiveness, absorption, durability). Product facts such as volume, ingredients, material, model number, packaging type, certifications and supported skin types belong ONLY in fact_sections and fact_field_candidates. Never score those facts as experience dimensions.\n- Do NOT copy generic templates; reason from the product identity below.

Product identity:
${identityBlock}`;

  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 1; attempt++) {
    const llm = await callLlmJson(prompt, 2200, 12000);
    lastErrors = llm.errors;
    const parsed = llm.data ? parseLlmBlueprintPayload(llm.data) : null;
    if (!parsed) continue;
    const classification = classificationFromLlm(parsed, input.domainResolution);
    const factSections = mapFactSections(parsed);
    const dimensions = mapDimensions(
      parsed.dimensions,
      parsed.secondary_dimensions,
      classification.domain,
      classification.productType,
      input.domainResolution?.domain,
    );
    if (dimensions.length >= 4 && factSections.length >= 1) {
      return { json: parsed, model: llm.model, classification, factSections, dimensions };
    }
  }

  throw new Error(`blueprint_llm_failed:${lastErrors.join("|") || "no_output"}`);
}
