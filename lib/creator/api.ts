import { db } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
import type { Investigation } from "@/lib/investigations/api";
import type { Creator } from "@/lib/community-v2/api";
export type Assignment = Investigation & {
  unmask_catalog: {
    name: string;
    image_url: string | null;
    brand: string | null;
  } | null;
};
export type Draft = {
  investigation_id: string;
  creator_id: string;
  accepted: boolean;
  brief_read: boolean;
  narrative_ready: boolean;
  title: string;
  summary: string;
  narrative: string;
  sources: string;
  response: string;
  disclosure: string;
  permissions_checked: boolean;
  commercial_checked: boolean;
  video_path: string | null;
  updated_at: string;
};
export type Submission = {
  id: string;
  investigation_id: string;
  creator_id: string;
  title: string;
  status: "in_review" | "changes_requested" | "approved";
  feedback: string;
  video_path: string;
  created_at: string;
};
export type Material = {
  id: string;
  investigation_id: string;
  label: string;
  kind: string;
  body: string;
  url: string | null;
  permission_note: string;
};
export type Earning = {
  id: string;
  investigation_id: string | null;
  label: string;
  amount_kobo: number;
  status: "pending" | "available" | "paid";
  created_at: string;
};
export type Payout = {
  id: string;
  amount_kobo: number;
  paid_at: string;
  reference: string;
  receipt_url: string | null;
};
async function read<T>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as T;
}
export const membership = async () =>
  read<Creator | null>(
    db()
      .from("unmask_creators")
      .select("user_id,display_name,handle,bio,specialties,avatar_url")
      .eq("user_id", await userId())
      .maybeSingle(),
  );
export const assignments = async () =>
  read<Assignment[]>(
    db()
      .from("unmask_investigations")
      .select("*,unmask_catalog(name,brand,image_url)")
      .eq("creator_id", await userId())
      .order("created_at", { ascending: false }),
  );
export const assignment = async (id: string) =>
  read<Assignment>(
    db()
      .from("unmask_investigations")
      .select("*,unmask_catalog(name,brand,image_url)")
      .eq("id", id)
      .eq("creator_id", await userId())
      .single(),
  );
export const drafts = async () =>
  read<Draft[]>(
    db()
      .from("unmask_creator_drafts")
      .select("*")
      .eq("creator_id", await userId()),
  );
export const draft = async (id: string) =>
  read<Draft | null>(
    db()
      .from("unmask_creator_drafts")
      .select("*")
      .eq("investigation_id", id)
      .eq("creator_id", await userId())
      .maybeSingle(),
  );
export const reviews = async () =>
  read<Submission[]>(
    db()
      .from("unmask_creator_submissions")
      .select(
        "id,investigation_id,creator_id,title,status,feedback,video_path,created_at",
      )
      .eq("creator_id", await userId())
      .order("created_at", { ascending: false }),
  );
export const materials = (id: string) =>
  read<Material[]>(
    db()
      .from("unmask_creator_materials")
      .select("id,investigation_id,label,kind,body,url,permission_note")
      .eq("investigation_id", id)
      .eq("approved", true),
  );
export const brief = (id: string) =>
  read<{ scope: string; permissions: string; due_on: string | null } | null>(
    db()
      .from("unmask_creator_briefs")
      .select("scope,permissions,due_on")
      .eq("investigation_id", id)
      .maybeSingle(),
  );
export async function saveDraft(id: string, patch: Partial<Draft>) {
  const existing = await draft(id);
  const { creator_id, investigation_id, ...safe } = { ...existing, ...patch };
  void creator_id;
  void investigation_id;
  return read<Draft>(
    db()
      .from("unmask_creator_drafts")
      .upsert(
        {
          ...safe,
          creator_id: await userId(),
          investigation_id: id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "investigation_id,creator_id" },
      )
      .select()
      .single(),
  );
}
export const submit = (id: string, key: string) =>
  read<string>(
    db().rpc("unmask_submit_creator_video", { p_id: id, p_key: key }),
  );
export const earnings = async () =>
  read<Earning[]>(
    db()
      .from("unmask_creator_earnings")
      .select("*")
      .eq("creator_id", await userId())
      .order("created_at", { ascending: false }),
  );
export const payouts = async () =>
  read<Payout[]>(
    db()
      .from("unmask_creator_payouts")
      .select("id,amount_kobo,paid_at,reference,receipt_url")
      .eq("creator_id", await userId())
      .order("paid_at", { ascending: false }),
  );
export const payoutSettings = async () =>
  read<{
    next_payout_on: string | null;
    bank_name: string | null;
    last_four: string | null;
  } | null>(
    db()
      .from("unmask_creator_payout_settings")
      .select("next_payout_on,bank_name,last_four")
      .eq("creator_id", await userId())
      .maybeSingle(),
  );
export const money = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const videoUrl = (path: string) =>
  read<{ signedUrl: string }>(
    db().storage.from("creator-videos").createSignedUrl(path, 120),
  );
export async function uploadVideo(
  id: string,
  uri: string,
  mime?: string,
  size?: number,
) {
  if (size && size > 52428800)
    throw new Error("Choose a video smaller than 50 MB.");
  const blob = await (await fetch(uri)).blob();
  const type = mime || blob.type;
  if (
    !["video/mp4", "video/quicktime", "video/webm"].includes(type) ||
    blob.size > 52428800
  )
    throw new Error("Use MP4, MOV or WebM up to 50 MB.");
  const path = `${await userId()}/${id}/${Date.now()}.${type === "video/quicktime" ? "mov" : type.split("/")[1]}`;
  const { error } = await db()
    .storage.from("creator-videos")
    .upload(path, await blob.arrayBuffer(), { contentType: type });
  if (error) throw error;
  return path;
}
export function emptyDraft(id: string, creator: string, title: string): Draft {
  return {
    investigation_id: id,
    creator_id: creator,
    accepted: false,
    brief_read: false,
    narrative_ready: false,
    title: title.slice(0, 100),
    summary: "",
    narrative: "",
    sources: "",
    response: "",
    disclosure: "Community-supported",
    permissions_checked: false,
    commercial_checked: false,
    video_path: null,
    updated_at: "",
  };
}
