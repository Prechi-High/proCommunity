import { ALGO_VERSION, buildPresentationFromProfile } from "./build.ts";
import type { ProductPresentationContract } from "./types.ts";
import type { DomainResolution } from "../domain/types.ts";
import { buildBlueprintRows } from "./build.ts";

type BuiltBlueprint = ReturnType<typeof buildBlueprintRows>;

type Json = Record<string, unknown>;

type Store = {
  upsert(table: string, row: Json): Promise<void>;
  insertMany(table: string, rows: Json[]): Promise<void>;
  remove(table: string, filter: string): Promise<void>;
};

export async function persistBlueprint(
  store: Store,
  productId: string,
  query: string,
  profile: Json,
  built: BuiltBlueprint,
  domainResolution?: DomainResolution,
): Promise<ProductPresentationContract> {
  const { classification, factSections, dimensions, blueprintId, version } = built;
  const refreshAfter = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  await store.upsert("product_blueprints", {
    id: blueprintId,
    product_id: productId,
    category_id: classification.categoryId,
    domain_id: domainResolution?.matchedDomainId || null,
    domain_status: domainResolution?.domainStatus || null,
    product_family: domainResolution?.productFamily || null,
    template_id: classification.templateId,
    product_type: domainResolution?.productType ?? classification.productType,
    product_subtype: domainResolution?.productSubtype ?? classification.productSubtype,
    domain_template_version: 1,
    classification_confidence: domainResolution?.classificationConfidence ?? classification.classificationConfidence,
    primary_uses: classification.primaryUses,
    buyer_expectations: classification.buyerExpectations,
    risk_factors: classification.riskFactors,
    blueprint_confidence: domainResolution?.classificationConfidence ?? classification.classificationConfidence,
    version,
    status: "active",
    generated_by_model: "blueprint-heuristic-v1",
    refresh_after: refreshAfter,
  });

  await store.remove("blueprint_sections", `blueprint_id=eq.${encodeURIComponent(blueprintId)}`);
  await store.remove("product_fact_sections", `blueprint_id=eq.${encodeURIComponent(blueprintId)}`);
  await store.remove("evaluation_dimensions", `blueprint_id=eq.${encodeURIComponent(blueprintId)}`);

  const presentation = buildPresentationFromProfile(productId, query, profile, blueprintId, version, domainResolution);

  const navRows = presentation.navigation.map((n, i) => ({
    id: `${blueprintId}_nav_${n.key}`,
    blueprint_id: blueprintId,
    section_key: n.key,
    label: n.label,
    section_type: n.key === "overview" || n.key === "evidence" || n.key === "videos" || n.key === "ask" ? "core" : "fact",
    renderer_type: n.renderer,
    display_order: i,
    enabled: true,
    config: {},
  }));
  await store.insertMany("blueprint_sections", navRows);

  const factSectionRows: Json[] = [];
  const factFieldRows: Json[] = [];
  const dimRows: Json[] = [];
  const assessRows: Json[] = [];

  for (let i = 0; i < factSections.length; i++) {
    const f = factSections[i];
    const sectionId = `${blueprintId}_fact_${f.key}`;
    factSectionRows.push({
      id: sectionId,
      blueprint_id: blueprintId,
      section_key: f.key,
      title: f.label,
      renderer_type: f.renderer,
      display_order: i,
      status: "active",
    });
    const fields = presentation.factSections.find((s) => s.key === f.key)?.fields ?? [];
    fields.forEach((field, fi) => {
      factFieldRows.push({
        id: `${sectionId}_${field.key}`,
        fact_section_id: sectionId,
        field_key: field.key,
        label: field.label,
        value: { text: field.value },
        confidence: 0.7,
        display_order: fi,
      });
    });
  }

  const findings = profile.findings as Json | undefined;
  const claims = (Array.isArray(findings?.claims) ? findings!.claims : []) as Json[];

  for (let i = 0; i < dimensions.length; i++) {
    const d = dimensions[i];
    const dimId = `${blueprintId}_dim_${d.key}`;
    dimRows.push({
      id: dimId,
      blueprint_id: blueprintId,
      key: d.key,
      label: d.label,
      importance: d.importance,
      display_order: i,
      why_it_matters: d.whyItMatters ?? null,
      origin: "blueprint",
    });
    const pres = presentation.overview.dimensions.find((x) => x.key === d.key);
    assessRows.push({
      id: `${dimId}_assess_${Date.now()}`,
      dimension_id: dimId,
      score: pres?.score ?? null,
      confidence_score: pres?.confidence ?? 0,
      finding: pres?.finding ?? null,
      evidence_count: pres?.evidenceCount ?? 0,
      algorithm_version: ALGO_VERSION,
    });
  }

  await store.insertMany("product_fact_sections", factSectionRows);
  await store.insertMany("product_fact_fields", factFieldRows);
  await store.insertMany("evaluation_dimensions", dimRows);
  await store.insertMany("dimension_assessments", assessRows);

  await store.upsert("product_intel", {
    id: productId,
    category_id: classification.categoryId,
    product_type: classification.productType,
    product_subtype: classification.productSubtype,
    classification_confidence: classification.classificationConfidence,
    blueprint_version: version,
  });

  return presentation;
}
