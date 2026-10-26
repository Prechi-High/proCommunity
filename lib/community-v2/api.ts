import { db, type Experience } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
export type DetailedExperience = Experience & {
  goal?: string;
  frequency?: string;
  outcome?: string;
};
export type Creator = {
  user_id: string;
  display_name: string;
  handle: string;
  bio: string;
  specialties: string[];
  avatar_url: string | null;
};
export type Publication = {
  id: string;
  creator_id: string;
  title: string;
  product_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  commercial_disclosure: string;
};
export type Entry = {
  attached_journey_id?: string | null;
  id: string;
  experience_id: string;
  attached_experience_id?: string | null;
  body: string;
  created_at: string;
  photo_path?: string | null;
  author_name?: string;
  duration?: string;
  usage_status?: string;
};
async function read<T>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
export const creators = () =>
  read<Creator[]>(
    db()
      .from("unmask_creators")
      .select("user_id,display_name,handle,bio,specialties,avatar_url")
      .eq("published", true)
      .order("display_name"),
  );
export const publications = (id?: string) => {
  let q = db()
    .from("unmask_creator_publications")
    .select(
      "id,creator_id,title,product_id,video_url,thumbnail_url,commercial_disclosure",
    )
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (id) q = q.eq("creator_id", id);
  return read<Publication[]>(q);
};
export const experience = (id: string) =>
  read<DetailedExperience>(
    db()
      .from("clarity_experiences")
      .select("*,unmask_catalog(name,brand,image_url)")
      .eq("id", id)
      .single(),
  );
export const entries = (id: string, kind: "followups" | "replies") =>
  read<Entry[]>(
    db()
      .from(`clarity_experience_${kind}`)
      .select("*")
      .eq("experience_id", id)
      .order("created_at"),
  );
export async function addEntry(
  id: string,
  body: string,
  kind: "followups" | "replies",
  duration = "",
  usage_status = "",
  photo_path = "",
  attachedExperience?: string,
  attachedJourney?: string,
) {
  const uid = await userId();
  const row: Record<string, string> = {
    experience_id: id,
    user_id: uid,
    body: body.trim(),
  };
  if (kind === "replies" && attachedJourney)
    row.attached_journey_id = attachedJourney;
  if (kind === "replies" && attachedExperience)
    row.attached_experience_id = attachedExperience;
  if (kind === "followups") {
    if (photo_path) row.photo_path = photo_path;
    row.duration = duration;
    row.usage_status = usage_status;
  } else {
    const p = await read<{ display_name: string }>(
      db().from("profiles").select("display_name").eq("id", uid).single(),
    );
    row.author_name = p.display_name;
  }
  return read<Entry>(
    db().from(`clarity_experience_${kind}`).insert(row).select().single(),
  );
}

export async function uploadPhoto(uri: string) {
  const uid = await userId();
  const blob = await (await fetch(uri)).blob();
  if (blob.size > 5 * 1024 * 1024)
    throw new Error("Choose an image smaller than 5 MB.");
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const out = await db()
    .storage.from("community-experiences")
    .upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (out.error) throw out.error;
  return path;
}
export async function photoUrl(path: string) {
  const out = await db()
    .storage.from("community-experiences")
    .createSignedUrl(path, 300);
  if (out.error) throw out.error;
  return out.data.signedUrl;
}
