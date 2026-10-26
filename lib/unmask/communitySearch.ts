import { db } from "@/lib/clarity/api";
import type { Product } from "@/lib/types";
import { cleanProductQuery } from "./communitySearchQuery";
export async function searchCommunityProducts(
  query: string,
): Promise<Product[]> {
  const q = cleanProductQuery(query).split(" ").join("%");
  if (q.length < 2) return [];
  const { data, error } = await db()
    .from("unmask_catalog")
    .select("id,name,brand,category,image_url")
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
    .order("name")
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand || "",
    category: p.category || "Product",
    heroImageUrl: p.image_url,
  }));
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
