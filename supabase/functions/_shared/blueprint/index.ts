import { recordDomainDemand, resolveDomain, type DomainStore } from "../domain/index.ts";
import { capture } from "../core/observability.ts";
import { buildProductUIContractV1 } from "../ui-contract/index.ts";
import { buildBlueprintRows, buildPresentationFromProfile } from "./build.ts";
import { loadPresentationFromDb } from "./load.ts";
import { persistBlueprint } from "./persist.ts";

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

/** Redis → Supabase → generate (spec §8.1). Redis hookup is optional; DB + inline build always available. */
export async function attachProductPresentation(
  store: Store | null,
  productId: string,
  query: string,
  profile: Json,
  opts?: { force?: boolean },
): Promise<Json> {
  if (!blueprintEnabled()) return profile;

  const existing = profile.presentation as Json | undefined;
  if (!opts?.force && existing?.version) return profile;

  if (store && !opts?.force) {
    const loaded = await loadPresentationFromDb(store, productId).catch(() => null);
    if (loaded) {
      const cached: Json = { ...profile, presentation: loaded };
      if (dynamicProductUiEnabled()) {
        try {
          cached.uiContract = buildProductUIContractV1(productId, cached, loaded);
        } catch {
          /* keep presentation only */
        }
      }
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

  const built = buildBlueprintRows(productId, query, profile);
  const presentation = store
    ? await persistBlueprint(store, productId, query, profile, built, domainResolution).catch(() =>
      buildPresentationFromProfile(productId, query, profile, built.blueprintId, built.version, domainResolution),
    )
    : buildPresentationFromProfile(productId, query, profile, built.blueprintId, built.version, domainResolution);

  const out: Json = { ...profile, presentation, domainResolution };
  if (dynamicProductUiEnabled() && presentation && typeof presentation === "object") {
    try {
      out.uiContract = buildProductUIContractV1(productId, out, presentation as import("./types.ts").ProductPresentationContract);
    } catch (e) {
      console.warn("ui_contract_build_failed", e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}

export type { ProductPresentationContract } from "./types.ts";
