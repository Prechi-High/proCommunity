import { recordDomainDemand, resolveDomain, type DomainStore } from "../domain/index.ts";
import { capture } from "../core/observability.ts";
import { buildProductUIContractV1 } from "../ui-contract/index.ts";
import { buildPresentationFromProfile } from "./build.ts";
import { readBlueprintCache, writeBlueprintCache } from "./cache.ts";
import { getOrBuildBlueprintPackage } from "./getOrBuild.ts";
import { loadPresentationFromDb } from "./load.ts";
import { persistBlueprint } from "./persist.ts";
import { presentationMatchesConversationEvidence } from "./presentationEvidenceSync.ts";

type Json = Record<string, unknown>;

type Store = DomainStore & {
  insertMany(table: string, rows: Json[]): Promise<void>;
  remove(table: string, filter: string): Promise<void>;
};

function blueprintEnabled(): boolean {
  const v = (Deno.env.get("DYNAMIC_BLUEPRINT_ENABLED") ?? "true").toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function dynamicProductUiEnabled(): boolean {
  const v = (Deno.env.get("DYNAMIC_PRODUCT_UI") ?? "true").toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function clientDimensionExperience(pres: import("./types.ts").ProductPresentationContract | undefined): Json | undefined {
  const de = pres?.dimensionExperience;
  if (!de) return undefined;
  return { algorithmVersion: de.algorithmVersion, byKey: de.byKey };
}

/** Redis → Supabase → LLM generate (spec §8.1). */
export async function attachProductPresentation(
  store: Store | null,
  productId: string,
  query: string,
  profile: Json,
  opts?: { force?: boolean },
): Promise<Json> {
  if (!blueprintEnabled()) return profile;

  try {
    return await attachProductPresentationInner(store, productId, query, profile, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("attach_product_presentation_failed", productId, msg);
    return { ...profile, blueprintAttachError: msg };
  }
}

async function attachProductPresentationInner(
  store: Store | null,
  productId: string,
  query: string,
  profile: Json,
  opts?: { force?: boolean },
): Promise<Json> {
  const existing = profile.presentation as Json | undefined;
  if (!opts?.force && existing?.version) {
    const pres = existing as import("./types.ts").ProductPresentationContract;
    if (!presentationMatchesConversationEvidence(profile, pres)) {
      /* fall through — recompute dimension experience from current conversationEvidence */
    } else {
    const out: Json = { ...profile };
    if (dynamicProductUiEnabled() && !out.uiContract) {
      try {
        out.uiContract = buildProductUIContractV1(productId, out, pres);
      } catch {
        /* keep presentation */
      }
    }
    return out;
    }
  }

  if (!opts?.force) {
    const redis = await readBlueprintCache(productId);
    if (redis.hit) {
      const pres = redis.payload.presentation;
      if (!presentationMatchesConversationEvidence(profile, pres)) {
        /* stale — rebuild below */
      } else {
      pres.intelligenceMeta = { ...pres.intelligenceMeta!, cacheSource: "redis" };
      const cached: Json = { ...profile, presentation: pres };
      if (redis.payload.uiContract) cached.uiContract = redis.payload.uiContract;
      else if (dynamicProductUiEnabled()) {
        try {
          cached.uiContract = buildProductUIContractV1(productId, cached, pres);
        } catch {
          /* presentation only */
        }
      }
      cached.dimensionExperience = clientDimensionExperience(pres);
      return cached;
      }
    }
  }

  if (store && !opts?.force) {
    const loaded = await loadPresentationFromDb(store, productId).catch(() => null);
    if (loaded && presentationMatchesConversationEvidence(profile, loaded)) {
      loaded.intelligenceMeta = { ...loaded.intelligenceMeta!, cacheSource: "supabase" };
      const cached: Json = { ...profile, presentation: loaded };
      if (dynamicProductUiEnabled()) {
        try {
          cached.uiContract = buildProductUIContractV1(productId, cached, loaded);
        } catch {
          /* keep presentation only */
        }
      }
      await writeBlueprintCache(productId, loaded, cached.uiContract as Json | undefined);
      cached.dimensionExperience = clientDimensionExperience(loaded);
      return cached;
    }
  }

  const identity = (profile.identity ?? {}) as Json;
  const domainResolution = await resolveDomain(store, {
    name: String(identity.name ?? ""),
    brand: String(identity.brand ?? ""),
    category: String(identity.category ?? ""),
    subcategory: String(identity.subcategory ?? ""),
  }, query);

  if (store && domainResolution.matchedDomainId) {
    void recordDomainDemand(store, domainResolution.matchedDomainId, "unmask", { productId }).catch(() => undefined);
  }

  void capture(
    domainResolution.createdInferred ? "inferred_domain_created" : "domain_resolved",
    productId,
    {
      domain: domainResolution.domain,
      domain_status: domainResolution.domainStatus,
      product_family: domainResolution.productFamily,
      product_type: domainResolution.productType,
      classification_confidence: domainResolution.classificationConfidence,
      channel: "product",
    },
  );

  const built = await getOrBuildBlueprintPackage(productId, query, profile, domainResolution);
  const presentation = store
    ? await persistBlueprint(store, productId, query, profile, built, domainResolution).catch(() =>
      buildPresentationFromProfile(productId, query, profile, built.blueprintId, built.version, domainResolution, {
        classification: built.classification,
        factSections: built.factSections,
        dimensions: built.dimensions,
        cacheSource: "fresh",
      }),
    )
    : buildPresentationFromProfile(productId, query, profile, built.blueprintId, built.version, domainResolution, {
      classification: built.classification,
      factSections: built.factSections,
      dimensions: built.dimensions,
      cacheSource: "fresh",
    });

  const out: Json = {
    ...profile,
    presentation,
    dimensionExperience: clientDimensionExperience(presentation as import("./types.ts").ProductPresentationContract),
    domainResolution,
    blueprintLlm: built.llmJson ?? null,
  };
  if (dynamicProductUiEnabled() && presentation && typeof presentation === "object") {
    try {
      out.uiContract = buildProductUIContractV1(productId, out, presentation as import("./types.ts").ProductPresentationContract);
    } catch (e) {
      console.warn("ui_contract_build_failed", e instanceof Error ? e.message : String(e));
    }
  }
  await writeBlueprintCache(
    productId,
    presentation as import("./types.ts").ProductPresentationContract,
    out.uiContract as Json | undefined,
  );
  return out;
}

export type { ProductPresentationContract } from "./types.ts";
