import type { ProductPresentationContract } from "../blueprint/types.ts";
import type { EvaluationDimensionUI, FindingUI, ProductSectionUI, ProductUIContractV1, RendererType } from "./types.ts";

type Json = Record<string, unknown>;

const ALLOWED_RENDERERS = new Set<string>([
  "fact_grid",
  "grouped_facts",
  "ingredient_list",
  "material_list",
  "score_grid",
  "evidence_list",
  "video_groups",
  "finding_list",
  "warning_list",
  "text_blocks",
  "key_value_list",
]);

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function confidenceLabel(c: number | undefined): "low" | "medium" | "high" | undefined {
  if (c === undefined) return undefined;
  if (c >= 0.75) return "high";
  if (c >= 0.45) return "medium";
  return "low";
}

function mapRenderer(r: string): RendererType {
  if (ALLOWED_RENDERERS.has(r)) return r as RendererType;
  if (r === "fact_groups" || r === "overview") return "grouped_facts";
  if (r === "ingredient_list") return "ingredient_list";
  if (r === "video_evidence") return "video_groups";
  if (r === "evidence") return "evidence_list";
  if (r === "ask") return "text_blocks";
  return "key_value_list";
}

export function buildProductUIContractV1(productId: string, profile: Json, presentation: ProductPresentationContract): ProductUIContractV1 {
  const identity = (profile.identity ?? {}) as Json;
  const name = str(identity.name) || str(profile.query) || productId;
  const brand = str(identity.brand);
  const images = Array.isArray(profile.images) ? profile.images : [];
  const hero = str(images[0]) || str(profile.hero_image_url);

  const domain = presentation.product.domain ?? {
    id: presentation.product.category,
    name: String(presentation.product.category),
    status: "official" as const,
  };

  const dimensions: EvaluationDimensionUI[] = (presentation.overview.dimensions ?? []).map((d, i) => ({
    id: `dim_${d.key}`,
    key: d.key,
    label: d.label,
    score: d.score ?? undefined,
    confidence: d.confidence,
    confidence_label: confidenceLabel(d.confidence),
    finding: d.finding,
    evidence_count: d.evidenceCount,
    display_order: i,
    evidence_filter_key: d.key,
  }));

  const discoveriesRaw = (profile.findings as Json | undefined)?.discoveries as Json[] | undefined;
  const discoveries: FindingUI[] = (discoveriesRaw ?? []).slice(0, 8).map((item, i) => ({
    id: `disc_${i}`,
    title: str(item.topic, 80) || "Discovery",
    finding: str(item.summary, 400) || str(item.observation, 400),
    evidence_count: Number(item.evidence_count ?? 0) || undefined,
  }));

  const sections: ProductSectionUI[] = [];
  let order = 0;

  for (const f of presentation.factSections ?? []) {
    if (!f.fields?.length) continue;
    const renderer = mapRenderer(f.renderer);
    sections.push({
      id: `sec_${f.key}`,
      key: f.key,
      title: f.title,
      renderer,
      display_order: order++,
      enabled: true,
      data: {
        fields: f.fields.map((field) => ({
          key: field.key,
          label: field.label,
          value: field.value,
          unit: field.unit ?? null,
        })),
      },
    });
  }

  const coreSections: Array<{ key: string; title: string; renderer: RendererType }> = [
    { key: "evidence", title: "Evidence", renderer: "evidence_list" },
    { key: "videos", title: "Videos", renderer: "video_groups" },
    { key: "ask", title: "Ask", renderer: "text_blocks" },
  ];
  for (const c of coreSections) {
    sections.push({
      id: `sec_${c.key}`,
      key: c.key,
      title: c.title,
      renderer: c.renderer,
      display_order: order++,
      enabled: true,
      data: { lazy: true },
    });
  }

  const navigation = (presentation.navigation ?? []).map((n, i) => ({
    key: n.key,
    label: n.label,
    section_ref: n.key === "overview" ? "overview" : n.key,
    display_order: i,
    enabled: true,
  }));

  const navKeys = new Set(navigation.map((n) => n.key));
  for (const s of sections) {
    if (!navKeys.has(s.key) && s.key !== "overview") {
      navigation.push({
        key: s.key,
        label: s.title,
        section_ref: s.key,
        display_order: navigation.length,
        enabled: true,
      });
    }
  }

  const sortedNav = navigation
    .filter((t) => t.enabled)
    .sort((a, b) => a.display_order - b.display_order);

  const contract: ProductUIContractV1 = {
    schema_version: "1",
    product: {
      id: productId,
      name,
      brand: brand || undefined,
      image_url: hero || undefined,
      domain: {
        id: domain.id,
        name: domain.name,
        status: domain.status === "inferred" ? "inferred" : "official",
      },
      product_family: presentation.product.productFamily,
      product_type: presentation.product.productType,
      product_subtype: presentation.product.productSubtype ?? undefined,
    },
    navigation: sortedNav,
    overview: {
      overall: {
        score: presentation.overview.score ?? undefined,
        verdict: presentation.overview.verdict,
      },
      dimensions,
      discoveries: discoveries.length ? discoveries : undefined,
    },
    sections,
    domain_notice: presentation.domainNotice
      ? {
          should_show: presentation.domainNotice.shouldShow,
          official_domains: presentation.domainNotice.officialDomains,
          can_vote: presentation.domainNotice.canVote,
        }
      : undefined,
    intelligence_meta: {
      blueprint_id: presentation.blueprintId,
      blueprint_version: presentation.blueprintVersion,
      domain_template_version: presentation.intelligenceMeta?.domainTemplateVersion,
      classification_confidence: presentation.intelligenceMeta?.classificationConfidence,
      generated_at: new Date().toISOString(),
    },
    ask_context: {
      product_id: productId,
      blueprint_id: presentation.blueprintId,
      available_fact_keys: sections.filter((s) => s.renderer !== "evidence_list" && s.renderer !== "video_groups").map((s) => s.key),
      available_dimension_keys: dimensions.map((d) => d.key),
    },
  };

  validateContract(contract);
  return contract;
}

export function validateContract(contract: ProductUIContractV1): void {
  if (contract.schema_version !== "1") throw new Error("invalid_schema_version");
  if (!contract.product.id) throw new Error("missing_product_id");
  const navKeys = new Set<string>();
  for (const t of contract.navigation) {
    if (navKeys.has(t.key)) throw new Error("duplicate_nav_key");
    navKeys.add(t.key);
  }
  const dimKeys = new Set<string>();
  for (const d of contract.overview.dimensions) {
    if (dimKeys.has(d.key)) throw new Error("duplicate_dimension_key");
    dimKeys.add(d.key);
    if (d.score !== undefined && (d.score < 0 || d.score > 100)) throw new Error("invalid_score");
    if (d.confidence !== undefined && (d.confidence < 0 || d.confidence > 1)) throw new Error("invalid_confidence");
  }
  for (const s of contract.sections) {
    if (!ALLOWED_RENDERERS.has(s.renderer)) throw new Error(`unsupported_renderer:${s.renderer}`);
  }
}
