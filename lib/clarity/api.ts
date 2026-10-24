import { supabase } from "@/lib/supabase";
import { userId } from "@/lib/living/api";
export function db() {
  if (!supabase) throw new Error("Connection unavailable. Please retry.");
  return supabase;
}
async function read<T>(
  p: PromiseLike<{
    data: unknown;
    error: {
      message: string;
    } | null;
  }>,
): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}
export type Experience = {
  photo_path?: string | null;
  goal?: string;
  frequency?: string;
  outcome?: string;
  id: string;
  user_id: string;
  product_id: string;
  author_name: string;
  duration: string;
  body: string;
  uncertainty: string;
  context: string;
  skin_type: string | null;
  acquisition: string;
  usage_status: string;
  would_rebuy: string;
  visibility: "public" | "private";
  created_at: string;
  unmask_catalog?: {
    name: string;
    brand: string;
    image_url: string | null;
  };
};
export const experiences = (own = false, productId?: string) => {
  let q = db()
    .from("clarity_experiences")
    .select("*,unmask_catalog(name,brand,image_url)")
    .order("created_at", { ascending: false })
    .limit(60);
  if (!own) q = q.eq("visibility", "public");
  if (productId) q = q.eq("product_id", productId);
  return own
    ? userId().then((id) => read<Experience[]>(q.eq("user_id", id)))
    : read<Experience[]>(q);
};
export async function saveExperience(
  row: Omit<
    Experience,
    "id" | "user_id" | "author_name" | "created_at" | "unmask_catalog"
  >,
  id?: string,
) {
  const uid = await userId();
  const { data, error } = await db()
    .from("profiles")
    .select("display_name")
    .eq("id", uid)
    .single();
  if (error) throw error;
  const value = {
    ...row,
    user_id: uid,
    author_name: data.display_name || "Member",
    updated_at: new Date().toISOString(),
  };
  return read<Experience>(
    id
      ? db()
          .from("clarity_experiences")
          .update(value)
          .eq("id", id)
          .eq("user_id", uid)
          .select()
          .single()
      : db().from("clarity_experiences").insert(value).select().single(),
  );
}
export async function removeExperience(id: string) {
  return read(
    db()
      .from("clarity_experiences")
      .delete()
      .eq("id", id)
      .eq("user_id", await userId()),
  );
}
export type EventPreferences = {
  joined: boolean;
  participation: string;
  category: string;
  reminder: string;
};
export const eventPreferences = async () =>
  read<EventPreferences | null>(
    db()
      .from("clarity_event_preferences")
      .select("joined,participation,category,reminder")
      .eq("user_id", await userId())
      .maybeSingle(),
  );
export const saveEventPreferences = async (p: EventPreferences) =>
  read(
    db()
      .from("clarity_event_preferences")
      .upsert({
        ...p,
        user_id: await userId(),
        updated_at: new Date().toISOString(),
      }),
  );
export const events = () =>
  read<
    Array<{
      id: string;
      title: string;
      starts_at: string;
      ends_at: string;
      category: string;
    }>
  >(
    db()
      .from("clarity_events")
      .select("*")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(1),
  );
export const activity = () =>
  read<{
    unique_products: number;
    new_this_week: number;
  }>(db().from("clarity_activity_summary").select("*").single());
export type CompletedProduct = {
  product_id: string;
  name: string;
  brand: string;
  category: string;
  image_url: string | null;
  first_completed_at: string | null;
};
export const completedProducts = () =>
  read<CompletedProduct[]>(
    db()
      .from("clarity_product_completions")
      .select("*")
      .order("first_completed_at", { ascending: false, nullsFirst: false })
      .limit(100),
  );
export type Preferences = {
  skin_type: string | null;
  skin_public: boolean;
  save_investigations: boolean;
};
export const preferences = async () =>
  read<Preferences | null>(
    db()
      .from("clarity_preferences")
      .select("skin_type,skin_public,save_investigations")
      .eq("user_id", await userId())
      .maybeSingle(),
  );
export const savePreferences = async (p: Preferences) =>
  read(
    db()
      .from("clarity_preferences")
      .upsert({ ...p, user_id: await userId() }),
  );
