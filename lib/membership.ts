import { db } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";

export async function memberIdentity(id: string) {
  const { data, error } = await db().from("unmask_member_identities")
    .select("user_id,claimed_at").eq("user_id", id).maybeSingle();
  if (error) throw error;
  return data as { user_id: string; claimed_at: string } | null;
}
export async function claimIdentity() {
  const uid = await userId();
  const { error } = await db().from("unmask_member_identities").insert({ user_id: uid });
  if (error && error.code !== "23505") throw error;
  return memberIdentity(uid);
}
export async function foundingInterest() {
  const { data, error } = await db().from("unmask_founding_interest")
    .select("created_at").eq("user_id", await userId()).maybeSingle();
  if (error) throw error;
  return data as { created_at: string } | null;
}
export async function joinFoundingInterest() {
  const { error } = await db().from("unmask_founding_interest").insert({ user_id: await userId() });
  if (error && error.code !== "23505") throw error;
}
