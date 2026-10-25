import { db } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
export type Bookmark = {
  id: string;
  investigation_id: string | null;
  experience_id: string | null;
  unmask_investigations: { title: string; concern: string } | null;
  clarity_experiences: {
    author_name: string;
    body: string;
    duration: string;
  } | null;
};
export async function bookmarks() {
  const { data, error } = await db()
    .from("unmask_bookmarks")
    .select(
      "id,investigation_id,experience_id,unmask_investigations(title,concern),clarity_experiences(author_name,body,duration)",
    )
    .eq("user_id", await userId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as Bookmark[];
}
export async function toggleBookmark(
  kind: "investigation" | "experience",
  id: string,
  existing?: string,
) {
  const client = db();
  const uid = await userId();
  const { error } = existing
    ? await client
        .from("unmask_bookmarks")
        .delete()
        .eq("id", existing)
        .eq("user_id", uid)
    : await client
        .from("unmask_bookmarks")
        .insert({ user_id: uid, [`${kind}_id`]: id });
  if (error) throw error;
}
export async function sendSupport(
  subject: string,
  reference: string,
  message: string,
) {
  const { data, error } = await db()
    .from("unmask_support_requests")
    .insert({ user_id: await userId(), subject, reference, message })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
export type HistoryEntry = {
  id: string;
  investigation_id: string;
  kind: string;
  amount: number;
  public_ack: boolean;
  created_at: string;
  unmask_investigations: {
    title: string;
    status: string;
    unmask_catalog: { image_url: string | null } | null;
  } | null;
};
export async function history() {
  const { data, error } = await db()
    .from("unmask_spark_contributions")
    .select(
      "id,investigation_id,kind,amount,public_ack,created_at,unmask_investigations(title,status,unmask_catalog(image_url))",
    )
    .eq("user_id", await userId())
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as unknown as HistoryEntry[];
}
export async function readAllActivity() {
  const { error } = await db()
    .from("unmask_activity")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", await userId())
    .is("read_at", null);
  if (error) throw error;
}
