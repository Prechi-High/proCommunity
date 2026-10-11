import { domainFlags } from "./flags.ts";
import { heuristicResolve } from "./heuristics.ts";
import { isNarrowDomainCandidate, normalizeAlias, slugFromDomainName } from "./normalize.ts";
import { loadDomainRegistry, registrySlugMap } from "./registry.ts";
import { ensureInferredDomainTemplate } from "./template.ts";
import type { DomainResolution } from "./types.ts";

type Json = Record<string, unknown>;

export type Store = {
  rows(path: string): Promise<Json[]>;
  select(table: string, filter: string): Promise<Json | null>;
  insert(table: string, row: Json): Promise<Json | null>;
  patch(table: string, filter: string, row: Json): Promise<void>;
  upsert(table: string, row: Json): Promise<void>;
};

type Identity = { name?: string; brand?: string; category?: string; subcategory?: string };

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function ensureInferredDomain(store: Store, canonicalName: string, slug: string): Promise<string | null> {
  if (!domainFlags.inferredDomainCreation()) return null;
  if (isNarrowDomainCandidate(canonicalName)) return null;

  const existing = await store.select("domain_registry", `slug=eq.${encodeURIComponent(slug)}`);
  if (existing?.id) return str(existing.id, 40);

  const row = await store.insert("domain_registry", {
    canonical_name: canonicalName,
    slug,
    status: "inferred",
    is_official: false,
    template_status: domainFlags.inferredDomainTemplates() ? "generating" : "missing",
  });
  const id = str(row?.id, 40);
  if (!id) return null;

  await store.insert("domain_aliases", {
    domain_id: id,
    alias: canonicalName,
    normalized_alias: normalizeAlias(canonicalName),
    source: "system",
    confidence: 0.9,
  });

  if (domainFlags.inferredDomainTemplates()) {
    await ensureInferredDomainTemplate(store, id, slug).catch(() => undefined);
  }
  return id;
}

export async function resolveDomain(
  store: Store | null,
  identity: Identity,
  query: string,
): Promise<DomainResolution> {
  if (!domainFlags.dynamicDomainResolution()) {
    return {
      matchedDomainId: "a1000001-0000-4000-8000-000000000001",
      domain: "Tech",
      domainSlug: "tech",
      domainStatus: "official",
      productFamily: identity.category || "General",
      productType: identity.subcategory || "Product",
      classificationConfidence: 0.5,
      reason: "Domain resolution disabled",
    };
  }

  const domains = await loadDomainRegistry(store);
  const bySlug = registrySlugMap(domains);
  const heuristic = heuristicResolve(identity, query, bySlug);

  if (heuristic) {
    let id = heuristic.matchedDomainId;
    let created = false;
    if (!id && heuristic.domainStatus === "inferred" && store) {
      id = (await ensureInferredDomain(store, heuristic.domain, heuristic.domainSlug)) ?? "";
      created = Boolean(id);
    }
    return { ...heuristic, matchedDomainId: id, createdInferred: created };
  }

  // Broad fallback: propose inferred "Lifestyle & Shopping" only if nothing matches — prefer alias on category text
  const catNorm = normalizeAlias(`${identity.category ?? ""} ${identity.subcategory ?? ""}`);
  for (const d of domains) {
    if (d.aliases.some((a) => catNorm.includes(a) || a.includes(catNorm))) {
      return {
        matchedDomainId: d.id,
        domain: d.canonicalName,
        domainSlug: d.slug,
        domainStatus: d.isOfficial ? "official" : "inferred",
        productFamily: identity.category || "General",
        productType: identity.subcategory || "Product",
        classificationConfidence: 0.72,
        reason: "Alias match on category metadata",
      };
    }
  }

  const fallbackName = "Lifestyle & Shopping";
  const fallbackSlug = slugFromDomainName(fallbackName);
  let fallbackId = bySlug.get(fallbackSlug)?.id ?? "";
  if (!fallbackId && store) {
    fallbackId = (await ensureInferredDomain(store, fallbackName, fallbackSlug)) ?? "";
  }

  return {
    matchedDomainId: fallbackId,
    domain: fallbackName,
    domainSlug: fallbackSlug,
    domainStatus: "inferred",
    productFamily: identity.category || "General",
    productType: identity.subcategory || "Product",
    classificationConfidence: 0.55,
    reason: "Broad inferred domain fallback",
    createdInferred: Boolean(fallbackId),
  };
}
