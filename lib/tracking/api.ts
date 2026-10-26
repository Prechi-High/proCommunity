import { db } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
import type { Journey } from "@/lib/living/types";
export type TrackedJourney = Journey & {
  usage_duration: string | null;
  skin_type: string | null;
  ownership_verified: boolean;
};
export type UsageUpdate = {
  id: string;
  journey_id: string;
  changed: string;
  usage_duration: string | null;
  skin_type: string | null;
  frequency_snapshot: string | null;
  status_snapshot: string | null;
  photo_path: string | null;
  visibility: string;
  created_at: string;
};
export type EvidenceSelection = {
  kind: "journey" | "experience";
  id: string;
  title: string;
  detail: string;
  author?: string;
  visibility: string;
  image?: string | null;
  productId?: string;
  owner?: boolean;
};
export async function updates(id: string): Promise<UsageUpdate[]> {
  const { data, error } = await db()
    .from("unmask_experience_updates")
    .select("*")
    .eq("journey_id", id)
    .eq("moderation_status", "published")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
export async function proof(id: string) {
  const { data, error } = await db()
    .from("unmask_ownership_proofs")
    .select("id,status,photo_path")
    .eq("journey_id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function uploadProof(uri: string) {
  const uid = await userId();
  const blob = await (await fetch(uri)).blob();
  if (blob.size > 5242880)
    throw new Error("Choose an ownership photo smaller than 5 MB.");
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await db()
    .storage.from("ownership-proofs")
    .upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  return path;
}
export async function submitProof(journeyId: string, path: string) {
  const { error } = await db()
    .from("unmask_ownership_proofs")
    .insert({
      journey_id: journeyId,
      user_id: await userId(),
      photo_path: path,
    });
  if (error) throw error;
}
export async function logUsage(
  id: string,
  operationId: string,
  data: {
    body: string;
    duration: string;
    frequency: string;
    skin_type: string;
    status: string;
    reason: string;
    visibility: string;
    photo_path?: string | null;
  },
) {
  const { error } = await db().rpc("unmask_log_usage", {
    p_journey: id,
    p_id: operationId,
    p_data: data,
  });
  if (error) throw error;
}
export function operationId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
export type Reminder = {
  kind: "log" | "routine";
  cadence: "daily" | "weekly";
  time_label: string;
  time_zone: string;
  enabled: boolean;
  next_at: string;
};
export function nextReminder(
  time: string,
  cadence: "daily" | "weekly",
  now = new Date(),
) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Use a time like 19:00.");
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else if (d <= now) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
export async function reminders(id: string): Promise<Reminder[]> {
  const { data, error } = await db()
    .from("unmask_tracking_reminders")
    .select("*")
    .eq("journey_id", id)
    .eq("user_id", await userId());
  if (error) throw error;
  return data ?? [];
}
export async function saveReminders(
  id: string,
  items: {
    kind: "log" | "routine";
    enabled: boolean;
    time: string;
    cadence: "daily" | "weekly";
  }[],
) {
  const uid = await userId();
  const time_zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  for (const i of items) {
    const { error } = await db()
      .from("unmask_tracking_reminders")
      .upsert(
        {
          user_id: uid,
          journey_id: id,
          kind: i.kind,
          cadence: i.cadence,
          time_label: i.time,
          time_zone,
          enabled: i.enabled,
          next_at: nextReminder(i.time, i.cadence),
        },
        { onConflict: "user_id,journey_id,kind" },
      );
    if (error) throw error;
  }
}
export async function attachmentOptions(): Promise<EvidenceSelection[]> {
  const uid = await userId();
  const [journeys, own, saved] = await Promise.all([
    db()
      .from("unmask_journeys")
      .select(
        "id,visibility,usage_duration,frequency,product_id,unmask_catalog!unmask_journeys_product_id_fkey(name,image_url)",
      )
      .eq("user_id", uid)
      .order("updated_at", { ascending: false }),
    db()
      .from("clarity_experiences")
      .select(
        "id,body,duration,author_name,visibility,user_id,product_id,unmask_catalog(name,image_url)",
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false }),
    db()
      .from("unmask_bookmarks")
      .select(
        "clarity_experiences(id,body,duration,author_name,visibility,user_id,product_id,unmask_catalog(name,image_url))",
      )
      .eq("user_id", uid)
      .not("experience_id", "is", null),
  ]);
  for (const r of [journeys, own, saved]) if (r.error) throw r.error;
  const result: EvidenceSelection[] = (journeys.data ?? []).map((j: any) => ({
    kind: "journey",
    id: j.id,
    title: j.unmask_catalog?.name || "My timeline",
    image: j.unmask_catalog?.image_url,
    productId: j.product_id,
    owner: true,
    detail:
      [j.usage_duration, j.frequency].filter(Boolean).join(" · ") ||
      "Usage timeline",
    visibility: j.visibility,
  }));
  const experiences = [
    ...(own.data ?? []),
    ...(saved.data ?? []).flatMap((s: any) =>
      s.clarity_experiences ? [s.clarity_experiences] : [],
    ),
  ];
  for (const e of experiences) {
    if (!result.some((x) => x.kind === "experience" && x.id === e.id))
      result.push({
        kind: "experience",
        id: e.id,
        title: e.unmask_catalog?.name || e.body.slice(0, 85),
        image: e.unmask_catalog?.image_url,
        productId: e.product_id,
        owner: e.user_id === uid,
        detail: e.duration || "Shared experience",
        author: e.author_name,
        visibility: e.visibility,
      });
  }
  return result;
}

/** Explicitly confirmed by the owner in EvidencePicker; atomically publishes journal chapters. */
export async function shareAttachment(
  source: EvidenceSelection,
): Promise<EvidenceSelection> {
  await userId();
  const { error } = await db().rpc("unmask_share_attachment", {
    p_kind: source.kind,
    p_id: source.id,
  });
  if (error) throw error;
  return { ...source, visibility: "public" };
}
