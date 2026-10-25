import { db, type Experience } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
export type Identity = {
  user_id: string;
  display_name: string;
  handle: string;
  bio: string;
  avatar_url: string | null;
  social_links: string[];
  show_support: boolean;
  show_counts: boolean;
};
export type Person = {
  user_id: string;
  display_name: string;
  handle: string;
  bio: string;
  avatar_url: string | null;
  is_creator: boolean;
};
async function read<T>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as T;
}
export const identity = (id: string) =>
  read<Identity | null>(
    db()
      .from("unmask_public_profiles")
      .select("*")
      .eq("user_id", id)
      .maybeSingle(),
  );
export const counts = (id: string) =>
  read<{ followers?: number; following?: number }>(
    db().rpc("unmask_profile_counts", { p_id: id }),
  );
export const people = (followers: boolean) =>
  read<Person[]>(db().rpc("unmask_my_people", { p_followers: followers }));
export const support = (id: string) =>
  read<{ id: string; title: string; status: string }[]>(
    db().rpc("unmask_profile_support", { p_id: id }),
  );
export const experiences = (id: string) =>
  read<Experience[]>(
    db()
      .from("clarity_experiences")
      .select("*,unmask_catalog(name,brand,image_url)")
      .eq("user_id", id)
      .eq("visibility", "public")
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: false })
      .limit(100),
  );
export const questions = (id: string) =>
  read<{ id: string; body: string; created_at: string }[]>(
    db()
      .from("unmask_questions")
      .select("id,body,created_at")
      .is("routine_id", null)
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  );
export async function save(row: Omit<Identity, "user_id">) {
  return read<Identity>(
    db()
      .from("unmask_public_profiles")
      .upsert({ ...row, user_id: await userId() })
      .select()
      .single(),
  );
}
export function safeLink(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export async function uploadAvatar(uri: string) {
  const uid = await userId();
  const blob = await (await fetch(uri)).blob();
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(blob.type) ||
    blob.size > 2097152
  )
    throw new Error("Choose a JPG, PNG, or WebP image smaller than 2 MB.");
  const ext = blob.type.split("/")[1];
  const path = `${uid}/${Date.now()}.${ext}`;
  const { error } = await db()
    .storage.from("unmask-avatars")
    .upload(path, await blob.arrayBuffer(), { contentType: blob.type });
  if (error) throw error;
  return db().storage.from("unmask-avatars").getPublicUrl(path).data.publicUrl;
}
