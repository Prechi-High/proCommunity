import { recordDomainDemand, resolveDomain, type DomainStore } from "../domain/index.ts";
import { capture } from "../core/observability.ts";
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
      return { ...profile, presentation: loaded };
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

  return { ...profile, presentation, domainResolution };
}

export type { ProductPresentationContract } from "./types.ts";
