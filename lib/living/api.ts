import { supabase } from "../supabase";
import type { Product } from "../types";
import type {
  Activity,
  Answer,
  Company,
  Experience,
  Journey,
  LivingProduct,
  Question,
  Routine,
  RoutineItem,
  Subscription,
} from "./types";
function db() {
  if (!supabase) throw new Error("Connection unavailable. Please try again.");
  return supabase;
}
export async function userId() {
  const { data } = await db().auth.getSession();
  if (!data.session) throw new Error("Sign in to keep your product history.");
  return data.session.user.id;
}
function unwrap<T>({
  data,
  error,
}: {
  data: unknown;
  error: { message: string } | null;
}): T {
  if (error) throw new Error(error.message);
  return data as T;
}
export async function registerProduct(
  p: Pick<Product, "id" | "name" | "brand" | "category" | "heroImageUrl">,
) {
  await userId();
  unwrap(
    await db().rpc("unmask_register_product", {
      p_id: p.id,
      p_name: p.name,
      p_brand: p.brand || "",
      p_category: p.category || "",
      p_image: p.heroImageUrl || null,
    }),
  );
}
export async function catalog(id?: string): Promise<LivingProduct[]> {
  let q = db().from("unmask_catalog").select("*").order("name").limit(150);
  if (id) q = q.eq("id", id);
  return unwrap(await q);
}
export async function company(id: string) {
  return unwrap<Company | null>(
    await db().from("unmask_companies").select("*").eq("id", id).maybeSingle(),
  );
}
export async function companyProducts(id: string) {
  return unwrap<LivingProduct[]>(
    await db()
      .from("unmask_catalog")
      .select("*")
      .eq("company_id", id)
      .order("name"),
  );
}
export async function journeys() {
  return unwrap<Journey[]>(
    await db()
      .from("unmask_journeys")
      .select(
        "*,unmask_catalog:unmask_catalog!unmask_journeys_product_id_fkey(*)",
      )
      .eq("user_id", await userId())
      .order("updated_at", { ascending: false }),
  );
}
export async function journey(id: string) {
  return unwrap<Journey>(
    await db()
      .from("unmask_journeys")
      .select(
        "*,unmask_catalog:unmask_catalog!unmask_journeys_product_id_fkey(*)",
      )
      .eq("id", id)
      .single(),
  );
}
export async function saveJourney(
  row: Partial<Journey> & { product_id: string; acquisition: string },
) {
  const uid = await userId();
  const existing = unwrap<{ id: string } | null>(
    await db()
      .from("unmask_journeys")
      .select("id")
      .eq("user_id", uid)
      .eq("product_id", row.product_id)
      .maybeSingle(),
  );
  if (existing)
    return unwrap<Journey>(
      await db()
        .from("unmask_journeys")
        .update(row)
        .eq("id", existing.id)
        .select()
        .single(),
    );
  return unwrap<Journey>(
    await db()
      .from("unmask_journeys")
      .insert({ ...row, user_id: uid })
      .select()
      .single(),
  );
}
export async function patchJourney(id: string, row: Partial<Journey>) {
  await userId();
  unwrap(
    await db()
      .from("unmask_journeys")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", id),
  );
}
export async function experiences(filter?: {
  productId?: string;
  journeyId?: string;
  personId?: string;
  context?: string;
}) {
  let q = db()
    .from("unmask_experience_feed")
    .select("*")
    .eq("is_demo", false)
    .eq("moderation_status", "published")
    .order("created_at", { ascending: false })
    .limit(60);
  if (filter?.productId) q = q.eq("product_id", filter.productId);
  if (filter?.journeyId) q = q.eq("journey_id", filter.journeyId);
  if (filter?.personId) q = q.eq("user_id", filter.personId);
  if (filter?.context)
    q = q.ilike("context", `%${filter.context.replace(/[%_]/g, "")}%`);
  return unwrap<Experience[]>(await q);
}
export async function addExperience(row: {
  journey_id: string;
  changed: string;
  unchanged: string;
  reaction: string;
  uncertainty: string;
  would_rebuy: boolean | null;
  visibility: string;
  photo_path?: string | null;
}) {
  await userId();
  return unwrap(await db().from("unmask_experience_updates").insert(row));
}
export async function removeExperience(id: string) {
  await userId();
  unwrap(await db().from("unmask_experience_updates").delete().eq("id", id));
}
export async function toggleHelpful(id: string) {
  const uid = await userId();
  const r = unwrap<unknown[]>(
    await db()
      .from("unmask_helpful")
      .select("update_id")
      .eq("user_id", uid)
      .eq("update_id", id),
  );
  unwrap(
    r.length
      ? await db()
          .from("unmask_helpful")
          .delete()
          .eq("user_id", uid)
          .eq("update_id", id)
      : await db()
          .from("unmask_helpful")
          .insert({ user_id: uid, update_id: id }),
  );
}
export async function routines(own = false) {
  let q = db()
    .from("routines")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (own) q = q.eq("user_id", await userId());
  else q = q.eq("visibility", "public");
  return unwrap<Routine[]>(await q);
}
export async function routine(id: string) {
  return unwrap<Routine>(
    await db().from("routines").select("*").eq("id", id).single(),
  );
}
export async function saveRoutine(row: Partial<Routine>) {
  const uid = await userId();
  return unwrap<Routine>(
    row.id
      ? await db()
          .from("routines")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .select()
          .single()
      : await db()
          .from("routines")
          .insert({ ...row, user_id: uid })
          .select()
          .single(),
  );
}
export async function routineItems(id: string) {
  return unwrap<RoutineItem[]>(
    await db()
      .from("unmask_routine_items")
      .select(
        "*,unmask_catalog(*)",
      )
      .eq("routine_id", id)
      .order("step_order"),
  );
}
export async function addRoutineItem(row: {
  routine_id: string;
  product_id: string;
  step_order: number;
  frequency: string;
}) {
  await userId();
  unwrap(await db().from("unmask_routine_items").insert(row));
}
export async function patchRoutineItem(
  id: string,
  row: { step_order?: number; stopped_on?: string | null },
) {
  await userId();
  unwrap(await db().from("unmask_routine_items").update(row).eq("id", id));
}
export async function routineEvents(id: string) {
  return unwrap<Array<{ id: string; body: string; created_at: string }>>(
    await db()
      .from("unmask_routine_events")
      .select("*")
      .eq("routine_id", id)
      .order("created_at", { ascending: false }),
  );
}
export async function addRoutineEvent(id: string, body: string) {
  await userId();
  unwrap(
    await db().from("unmask_routine_events").insert({ routine_id: id, body }),
  );
}
export async function subscriptions() {
  return unwrap<Subscription[]>(
    await db()
      .from("unmask_subscriptions")
      .select("*")
      .eq("user_id", await userId()),
  );
}
export async function follow(
  type: string,
  id: string,
  prefs = ["experiences", "questions"],
) {
  unwrap(
    await db()
      .from("unmask_subscriptions")
      .upsert({
        user_id: await userId(),
        target_type: type,
        target_id: id,
        preferences: prefs,
      }),
  );
}
export async function unfollow(type: string, id: string) {
  unwrap(
    await db()
      .from("unmask_subscriptions")
      .delete()
      .eq("user_id", await userId())
      .eq("target_type", type)
      .eq("target_id", id),
  );
}
export async function questions(productId?: string, routineId?: string) {
  let q = db()
    .from("unmask_questions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (productId) q = q.eq("product_id", productId);
  if (routineId) q = q.eq("routine_id", routineId);
  return unwrap<Question[]>(await q);
}
export async function question(id: string) {
  return unwrap<Question>(
    await db().from("unmask_questions").select("*").eq("id", id).single(),
  );
}
export async function addQuestion(row: {
  product_id?: string;
  routine_id?: string;
  body: string;
  context?: string;
}) {
  await userId();
  return unwrap<Question>(
    await db().from("unmask_questions").insert(row).select().single(),
  );
}
export async function answers(id: string) {
  return unwrap<Answer[]>(
    await db()
      .from("unmask_answers")
      .select("*")
      .eq("question_id", id)
      .order("created_at"),
  );
}
export async function addAnswer(row: {
  question_id: string;
  duration: string;
  context: string;
  acquisition: string;
  body: string;
  uncertainty: string;
}) {
  await userId();
  unwrap(await db().from("unmask_answers").insert(row));
}
export async function activity() {
  return unwrap<Activity[]>(
    await db()
      .from("unmask_activity")
      .select("*")
      .eq("user_id", await userId())
      .order("created_at", { ascending: false })
      .limit(40),
  );
}
export async function readActivity(id: string) {
  unwrap(
    await db()
      .from("unmask_activity")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id),
  );
}
export async function requestProduct(name: string, brand: string) {
  await userId();
  unwrap(
    await db()
      .from("unmask_requests")
      .insert({ name: name.trim(), brand: brand.trim(), category: "skincare" }),
  );
}
export async function requests() {
  return unwrap<
    Array<{
      id: string;
      name: string;
      status: string;
      product_id: string | null;
    }>
  >(
    await db()
      .from("unmask_requests")
      .select("*")
      .eq("user_id", await userId())
      .order("created_at", { ascending: false }),
  );
}
export async function uploadPhoto(uri: string) {
  const uid = await userId();
  const blob = await (await fetch(uri)).blob();
  if (blob.size > 5 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 5 MB.");
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  unwrap(
    await db()
      .storage.from("experience-history")
      .upload(path, blob, { contentType: blob.type || "image/jpeg" }),
  );
  return path;
}
export async function photoUrl(path: string) {
  const r = await db()
    .storage.from("experience-history")
    .createSignedUrl(path, 120);
  if (r.error) throw r.error;
  return r.data.signedUrl;
}
