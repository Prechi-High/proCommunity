import type { DomainResolution } from "../domain/types.ts";
import { buildDimensionExperiencePackage, DIMENSION_EVIDENCE_ALGO } from "../evidence/pipeline.ts";
import { validateDimensionSemantics, inferDomainFromProductType } from "../evidence/validateDimensions.ts";
import type {
  PresentationFactField,
  PresentationFactSection,
  PresentationNavItem,
  ProductPresentationContract,
  BlueprintDimensionDef,
  BlueprintFactSectionDef,
  ProductClassification,
} from "./types.ts";

type Json = Record<string, unknown>;
type SpecRow = { label?: string; value?: string };
const ALGO_VERSION = "blueprint-v2";
const PRESENTATION_VERSION = 1;

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function mapSpecsToFields(specs: SpecRow[], fieldKeys: string[]): PresentationFactField[] {
  const out: PresentationFactField[] = [];
  const used = new Set<string>();
  for (const key of fieldKeys) {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const hit = specs.find((s) => {
      const l = str(s.label, 80).toLowerCase();
      return l.includes(key.replace(/_/g, " ")) || l.includes(key.replace(/_/g, ""));
    });
    if (hit?.value) {
      out.push({ key, label: str(hit.label, 80) || label, value: str(hit.value, 200) });
      used.add(key);
    }
  }
  for (const s of specs) {
    const label = str(s.label, 80);
    const value = str(s.value, 200);
    if (!label || !value) continue;
    const key = label.toLowerCase().replace(/\s+/g, "_").slice(0, 40);
    if (used.has(key)) continue;
    out.push({ key, label, value });
    if (out.length >= 12) break;
  }
  return out;
}

function buildNavigation(factSections: { key: string; label: string; renderer: string }[]): PresentationNavItem[] {
  const nav: PresentationNavItem[] = [{ key: "overview", label: "Overview", renderer: "overview" }];
  for (const f of factSections) {
    nav.push({ key: f.key, label: f.label, renderer: f.renderer });
  }
  nav.push(
    { key: "evidence", label: "Evidence", renderer: "evidence" },
    { key: "videos", label: "Videos", renderer: "video_evidence" },
    { key: "ask", label: "Ask", renderer: "ask" },
  );
  return nav;
}

export function buildPresentationFromProfile(
  productId: string,
  query: string,
  profile: Json,
  blueprintId: string,
  blueprintVersion: number,
  domainResolution?: DomainResolution,
  schema?: {
    classification: ProductClassification;
    factSections: BlueprintFactSectionDef[];
    dimensions: BlueprintDimensionDef[];
    cacheSource?: "redis" | "supabase" | "fresh";
  },
): ProductPresentationContract {
  const identity = (profile.identity ?? {}) as Json;
  if (!schema) throw new Error("blueprint_schema_required");
  const classification = schema.classification;
  const factDefs = schema.factSections;
  const dimDefs = schema.dimensions;
  const specs = (Array.isArray(profile.specs) ? profile.specs : []) as SpecRow[];

  const factSections: PresentationFactSection[] = factDefs.map((f) => ({
    key: f.key,
    title: f.label,
    renderer: f.renderer,
    fields: mapSpecsToFields(specs, f.fieldKeys),
  }));

  const semanticDomain = inferDomainFromProductType(
    domainResolution?.productType ?? classification.productType,
    domainResolution?.domain,
  );
  const sem = validateDimensionSemantics(
    semanticDomain,
    domainResolution?.productType ?? classification.productType,
    dimDefs.map((d) => ({ key: d.key, label: d.label })),
  );
  const filteredDimDefs = sem.rejected.length
    ? dimDefs.filter((d) => !sem.rejected.includes(d.key))
    : dimDefs;

  const { package: dimExperience } = buildDimensionExperiencePackage({
    productId,
    blueprintId,
    query,
    profile,
    dimensions: filteredDimDefs,
  });

  const overviewDims = filteredDimDefs.map((d) => {
    const b = dimExperience.byKey[d.key];
    return {
      key: d.key,
      label: d.label,
      score: b?.score ?? null,
      confidence: b?.confidence ?? 0.15,
      evidenceCount: b?.evidenceCount ?? 0,
      limitedEvidence: (b?.evidenceCount ?? 0) < 2 && (b?.score == null),
      finding: b?.finding ?? "Not enough validated owner reports yet for a clear read.",
      dimensionId: b?.dimensionId ?? `${blueprintId}_dim_${d.key}`,
      positiveCount: b?.positiveCount ?? 0,
      mixedCount: b?.mixedCount ?? 0,
      negativeCount: b?.negativeCount ?? 0,
    };
  });
  const scored = overviewDims.map((d) => d.score).filter((s): s is number => s !== null);
  const profileScore = profile.score !== null && profile.score !== undefined ? Number(profile.score) : null;
  const overviewScore = profileScore !== null && !Number.isNaN(profileScore)
    ? Math.round(profileScore)
    : scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;

  const verdict =
    str(profile.verdict) ||
    str(profile.consensus) ||
    str(profile.summary) ||
    "We’re still organising what owners report about this product.";

  const navigation = buildNavigation(factDefs);

  const identityName = str(identity.name);
  const domainStatus = domainResolution?.domainStatus ?? (classification.domain === "tech" || classification.domain === "beauty" || classification.domain === "home-appliances" ? "official" : "inferred");
  const isInferred = domainStatus === "inferred";

  return {
    version: PRESENTATION_VERSION,
    blueprintId,
    blueprintVersion,
    product: {
      id: productId,
      name: identityName,
      category: classification.domain,
      domain: domainResolution
        ? { id: domainResolution.matchedDomainId, name: domainResolution.domain, status: domainResolution.domainStatus }
        : undefined,
      productFamily: domainResolution?.productFamily ?? classification.productType,
      productType: domainResolution?.productType ?? classification.productType,
      productSubtype: domainResolution?.productSubtype ?? classification.productSubtype,
    },
    domainNotice: {
      shouldShow: isInferred,
      officialDomains: ["Tech", "Beauty", "Home Appliances"],
      canVote: isInferred,
    },
    intelligenceMeta: {
      blueprintVersion,
      domainTemplateVersion: 1,
      classificationConfidence: domainResolution?.classificationConfidence ?? classification.classificationConfidence,
      cacheSource: schema.cacheSource ?? "fresh",
    },
    navigation,
    overview: {
      score: overviewScore,
      verdict,
      dimensions: overviewDims,
    },
    factSections,
    dimensionExperience: {
      algorithmVersion: dimExperience.algorithmVersion,
      byKey: dimExperience.byKey,
      normalizedRows: dimExperience.normalizedRows,
    },
    dimensionEvidenceAlgorithm: DIMENSION_EVIDENCE_ALGO,
  };
}

export type BuiltBlueprintPackage = {
  classification: ProductClassification;
  factSections: BlueprintFactSectionDef[];
  dimensions: BlueprintDimensionDef[];
  blueprintId: string;
  version: number;
  generatedByModel: string;
  llmJson?: Record<string, unknown>;
};

export { ALGO_VERSION };
