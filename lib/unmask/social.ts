import { db } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
import type { FeedKind } from "./feed";
export type PostStats = { likes: number; liked: boolean; comments: number };
export function postId(href: string) {
  return href.split("/").filter(Boolean).pop()!;
}
export async function postStats(
  kind: FeedKind,
  id: string,
): Promise<PostStats | null> {
  const { data, error } = await db().rpc("unmask_post_stats", {
    p_kind: kind,
    p_id: id,
  });
  if (error) throw error;
  return data;
}
export async function setPostLike(kind: FeedKind, id: string, liked: boolean) {
  const uid = await userId();
  const q = liked
    ? db()
        .from("unmask_story_likes")
        .insert({ target_kind: kind, target_id: id, user_id: uid })
    : db()
        .from("unmask_story_likes")
        .delete()
        .eq("target_kind", kind)
        .eq("target_id", id)
        .eq("user_id", uid);
  const { error } = await q;
  if (error && !(liked && error.code === "23505")) throw error;
}
export async function unmaskComments(id: string) {
  const { data, error } = await db()
    .from("unmask_story_comments")
    .select("id,user_id,body,created_at")
    .eq("investigation_id", id)
    .order("created_at")
    .limit(100);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((x) => x.user_id))];
  if (!ids.length) return [];
  const people = await db()
    .from("profiles")
    .select("id,display_name")
    .in("id", ids);
  return rows.map((x) => ({
    ...x,
    author_name:
      people.data?.find((p) => p.id === x.user_id)?.display_name || "Unmasker",
  }));
}
export async function addUnmaskComment(id: string, body: string) {
  const uid = await userId();
  const { error } = await db()
    .from("unmask_story_comments")
    .insert({ investigation_id: id, user_id: uid, body: body.trim() });
  if (error) throw error;
}
