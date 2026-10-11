import type { DomainResolution } from "../domain/types.ts";
import { classifyProduct, resolveBlueprintSchema } from "./classify.ts";
import type {
  PresentationDimension,
  PresentationFactField,
  PresentationFactSection,
  PresentationNavItem,
  ProductPresentationContract,
  BlueprintDimensionDef,
} from "./types.ts";

type Json = Record<string, unknown>;
type SpecRow = { label?: string; value?: string };
type ClaimRow = { id?: string; topic?: string; brandStatement?: string; criterion?: string; score?: number | null; eligibleOwnerCount?: number; findingLabel?: string; buyingImplication?: string };

const ALGO_VERSION = "blueprint-v1";
const PRESENTATION_VERSION = 1;

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function matchClaimScore(claims: ClaimRow[], keywords: string[]): { score: number | null; confidence: number; finding: string; evidenceCount: number } {
  let best: ClaimRow | null = null;
  let bestHits = 0;
  for (const c of claims) {
    const hay = `${c.topic ?? ""} ${c.brandStatement ?? ""} ${c.criterion ?? ""}`.toLowerCase();
    const hits = keywords.filter((k) => hay.includes(k)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = c;
    }
  }
  if (!best || best.score === null || best.score === undefined) {
    return { score: null, confidence: 0.2, finding: "Limited owner evidence so far.", evidenceCount: 0 };
  }
  const count = best.eligibleOwnerCount ?? 0;
  const confidence = Math.min(0.95, 0.35 + Math.min(count, 40) * 0.015 + (bestHits > 0 ? 0.15 : 0));
  return {
    score: Math.round(Number(best.score) * 10),
    confidence,
    finding: str(best.buyingImplication || best.findingLabel || "Owners report mixed experiences."),
    evidenceCount: count,
  };
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

function scoreDimensions(dimensions: BlueprintDimensionDef[], claims: ClaimRow[]): PresentationDimension[] {
  return dimensions.map((d) => {
    const { score, confidence, finding, evidenceCount } = matchClaimScore(claims, d.keywords);
    const limitedEvidence = evidenceCount < 5 || confidence < 0.45;
    return {
      key: d.key,
      label: d.label,
      score: limitedEvidence && score !== null && confidence < 0.45 ? null : score,
      confidence,
      evidenceCount,
      limitedEvidence,
      finding,
    };
  });
}

export function buildPresentationFromProfile(
  productId: string,
  query: string,
  profile: Json,
  blueprintId: string,
  blueprintVersion: number,
  domainResolution?: DomainResolution,
): ProductPresentationContract {
  const identity = (profile.identity ?? {}) as Json;
  const classification = classifyProduct(
    {
      name: str(identity.name),
      brand: str(identity.brand),
      category: str(identity.category),
      subcategory: str(identity.subcategory),
    },
    query,
  );
  const { factSections: factDefs, dimensions: dimDefs } = resolveBlueprintSchema(classification, identity, query);
  const specs = (Array.isArray(profile.specs) ? profile.specs : []) as SpecRow[];
  const findings = profile.findings as Json | undefined;
  const claims = (Array.isArray(findings?.claims) ? findings!.claims : []) as ClaimRow[];

  const factSections: PresentationFactSection[] = factDefs.map((f) => ({
    key: f.key,
    title: f.label,
    renderer: f.renderer,
    fields: mapSpecsToFields(specs, f.fieldKeys),
  }));

  const overviewDims = scoreDimensions(dimDefs, claims);
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
      cacheSource: "fresh",
    },
    navigation,
    overview: {
      score: overviewScore,
      verdict,
      dimensions: overviewDims,
    },
    factSections,
  };
}

export function buildBlueprintRows(
  productId: string,
  query: string,
  profile: Json,
): {
  classification: ReturnType<typeof classifyProduct>;
  factSections: ReturnType<typeof resolveBlueprintSchema>["factSections"];
  dimensions: ReturnType<typeof resolveBlueprintSchema>["dimensions"];
  blueprintId: string;
  version: number;
} {
  const identity = (profile.identity ?? {}) as Json;
  const classification = classifyProduct(
    {
      name: str(identity.name),
      brand: str(identity.brand),
      category: str(identity.category),
      subcategory: str(identity.subcategory),
    },
    query,
  );
  const schema = resolveBlueprintSchema(classification, identity, query);
  const version = 1;
  const blueprintId = `bp_${productId}_v${version}`;
  return { classification, factSections: schema.factSections, dimensions: schema.dimensions, blueprintId, version };
}

export { ALGO_VERSION };
