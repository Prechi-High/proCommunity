import { db } from "@/lib/clarity/api";
import type { Product } from "@/lib/types";
import { dedupeCatalogProducts } from "./beautyCatalog";
import { cleanProductQuery } from "./communitySearchQuery";
export async function searchCommunityProducts(
  query: string,
): Promise<Product[]> {
  const { data, error } = await db().rpc("unmask_find_products", {
    p_query: cleanProductQuery(query),
  });
  if (error) throw error;
  const mapped = (data ?? []).map(
    (p: {
      id: string;
      name: string;
      brand: string | null;
      category: string | null;
      image_url: string | null;
    }) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || "",
      category: p.category || "Product",
      heroImageUrl: p.image_url,
    }),
  );
  return dedupeCatalogProducts(mapped);
}

export type PopularBeautyProduct = Product & { searchCount: number };

export async function popularBeautyProducts(limit = 12): Promise<PopularBeautyProduct[]> {
  const { data, error } = await db().rpc("unmask_popular_beauty_products", {
    p_limit: limit,
  });
  if (error) throw error;
  return dedupeCatalogProducts(
    (data ?? []).map(
      (p: {
        id: string;
        name: string;
        brand: string | null;
        category: string | null;
        image_url: string | null;
        search_count: number;
      }) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        category: p.category || "Beauty",
        heroImageUrl: p.image_url,
        searchCount: Number(p.search_count) || 0,
      }),
    ),
  );
}
export async function hasProductConversation(id: string) {
  const checks = await Promise.all([
    db()
      .from("clarity_experiences")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id)
      .eq("visibility", "public")
      .eq("moderation_status", "visible"),
    db()
      .from("unmask_questions")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id)
      .is("routine_id", null)
      .eq("moderation_status", "visible"),
    db()
      .from("unmask_investigations")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id),
  ]);
  for (const result of checks) if (result.error) throw result.error;
  return checks.some((r) => (r.count ?? 0) > 0);
}
