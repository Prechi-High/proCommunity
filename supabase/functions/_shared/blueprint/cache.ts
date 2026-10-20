import { productBlueprintKey, productDimensionKey, productEvidenceKey, productOverviewKey } from "../redis/keys.ts";
import { redisService } from "../redis/service.ts";
import { CACHE_TTL } from "../redis/ttl.ts";
import type { ProductPresentationContract } from "./types.ts";

type Json = Record<string, unknown>;

export type BlueprintCachePayload = {
  presentation: ProductPresentationContract;
  uiContract?: Json;
  cachedAt: string;
};

export async function readBlueprintCache(productId: string): Promise<
  | { hit: true; payload: BlueprintCachePayload; source: "redis" }
  | { hit: false; source: "miss" | "redis_error"; error?: string }
> {
  const key = productBlueprintKey(productId);
  const res = await redisService.getJson<BlueprintCachePayload>(key);
  if (!res.ok) {
    return { hit: false, source: res.error === "redis_unconfigured" ? "miss" : "redis_error", error: res.error };
  }
  if (!res.value?.presentation?.version) return { hit: false, source: "miss" };
  return { hit: true, payload: res.value, source: "redis" };
}

export async function writeBlueprintCache(
  productId: string,
  presentation: ProductPresentationContract,
  uiContract?: Json,
): Promise<void> {
  const key = productBlueprintKey(productId);
  await redisService.setJson(
    key,
    { presentation, uiContract, cachedAt: new Date().toISOString() },
    CACHE_TTL.blueprint(),
  );

  const overview = {
    score: presentation.overview?.score ?? null,
    dimensions: presentation.overview?.dimensions ?? [],
    algorithm: presentation.dimensionEvidenceAlgorithm ?? null,
  };
  const writes: Promise<unknown>[] = [redisService.setJson(productOverviewKey(productId), overview, CACHE_TTL.overview())];
  const dimExp = presentation.dimensionExperience;
  if (dimExp?.byKey) {
    for (const [dimKey, bundle] of Object.entries(dimExp.byKey)) {
      writes.push(redisService.setJson(productDimensionKey(productId, dimKey), bundle, CACHE_TTL.dimension()));
      writes.push(redisService.setJson(productEvidenceKey(productId, dimKey), bundle.items ?? [], CACHE_TTL.evidence()));
    }
  }
  await Promise.all(writes);
}
