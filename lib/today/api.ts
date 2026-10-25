import { db, type Experience } from "@/lib/clarity/api";
import type { Investigation } from "@/lib/investigations/api";
export type BrowseItem = Investigation & {
  product_name: string | null;
  product_image: string | null;
  category: string | null;
  starter_name: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
  sparks: number;
  thunder: number;
  supporters: number;
};
export async function browse(
  search = "",
  category = "All",
  sort = "Recent",
  offset = 0,
) {
  const { data, error } = await db().rpc("unmask_browse_investigations", {
    p_search: search,
    p_category: category,
    p_sort: sort,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return data as BrowseItem[];
}
export type Update = {
  id: string;
  body: string;
  created_at: string;
  clarity_experiences: Experience;
};
export async function followedUpdates(products: string[]) {
  if (!products.length) return [];
  const { data, error } = await db()
    .from("clarity_experience_followups")
    .select(
      "id,body,created_at,clarity_experiences!inner(*,unmask_catalog(name,brand,image_url))",
    )
    .eq("clarity_experiences.visibility", "public")
    .in("clarity_experiences.product_id", products)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);
  return data as unknown as Update[];
}
