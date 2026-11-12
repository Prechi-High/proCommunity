import { readPhoto } from "@/lib/tracking/photos";
import { userId } from "@/lib/living/api";
import { supabase } from "@/lib/supabase";

import {
  composeCard,
  expressionFromRow,
  momentFromRow,
  type Expression,
  type ExpressionRow,
  type Moment,
  type MomentRow,
  type PersonRow,
  type UnmaskCard,
} from "./model";

const BUCKET = "unmask-social";

type DbError = { code?: string; message?: string } | null;

function missing(error: DbError) {
  const blob = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return /42P01|PGRST205|does not exist|schema cache|Could not find/i.test(blob);
}

function client() {
  if (!supabase) throw new Error("Connection unavailable. Please retry.");
  return supabase;
}

export function mediaUrl(path: string) {
  return client().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function people(ids: string[]) {
  const map = new Map<string, PersonRow>();
  if (!ids.length || !supabase) return map;
  const { data, error } = await supabase
    .from("unmask_public_profiles")
    .select("user_id,display_name,handle,avatar_url")
    .in("user_id", ids);
  if (error || !data) return map;
  for (const row of data as Array<PersonRow & { user_id: string }>) {
    map.set(row.user_id, row);
  }
  return map;
}

export async function listMoments(): Promise<Moment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("unmask_moments")
    .select("id,user_id,media_path,media_kind,caption,attach_kind,attach_id,attach_label,poll_prompt,poll_a,poll_b,created_at,expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) {
    if (missing(error)) return [];
    throw new Error("Stories couldn’t load.");
  }
  const rows = (data ?? []) as Array<MomentRow & { media_path: string }>;
  const names = await people([...new Set(rows.map((row) => row.user_id))]);
  return rows.map((row) => momentFromRow(row, names.get(row.user_id), mediaUrl(row.media_path)));
}

export async function listPosts(): Promise<Expression[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("unmask_expressions")
    .select("id,user_id,media_path,media_kind,caption,product_id,journey_id,attach_card,attach_label,created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    if (missing(error)) return [];
    throw new Error("Posts couldn’t load.");
  }
  const rows = (data ?? []) as Array<ExpressionRow & { media_path: string }>;
  const names = await people([...new Set(rows.map((row) => row.user_id))]);
  return rows.map((row) => expressionFromRow(row, names.get(row.user_id), mediaUrl(row.media_path)));
}

async function upload(uri: string, kind: "photo" | "video") {
  const uid = await userId();
  const blob = await readPhoto(uri);
  const limit = kind === "video" ? 24 * 1024 * 1024 : 8 * 1024 * 1024;
  if (blob.size > limit) {
    throw new Error(kind === "video" ? "Choose a video under 24 MB." : "Choose a photo under 8 MB.");
  }
  const type = blob.type || (kind === "video" ? "video/mp4" : "image/jpeg");
  const ext = type.includes("png")
    ? "png"
    : type.includes("webp")
      ? "webp"
      : type.includes("quicktime")
        ? "mov"
        : kind === "video"
          ? "mp4"
          : "jpg";
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const out = await client().storage.from(BUCKET).upload(path, blob, { contentType: type });
  if (out.error) {
    if (missing(out.error)) throw new Error("Photo upload is not open yet.");
    throw new Error("Could not upload that photo.");
  }
  return path;
}

export async function publishMoment(input: {
  uri: string;
  kind: "photo" | "video";
  caption: string;
  attach?: { kind: "card" | "product" | "timeline"; id: string; label: string } | null;
  poll?: { prompt: string; a: string; b: string } | null;
}) {
  const uid = await userId();
  const path = await upload(input.uri, input.kind);
  const { error } = await client()
    .from("unmask_moments")
    .insert({
      user_id: uid,
      media_path: path,
      media_kind: input.kind,
      caption: input.caption.trim().slice(0, 180),
      attach_kind: input.attach?.kind ?? null,
      attach_id: input.attach?.id ?? null,
      attach_label: input.attach?.label ?? null,
      poll_prompt: input.poll?.prompt ?? null,
      poll_a: input.poll?.a ?? null,
      poll_b: input.poll?.b ?? null,
    });
  if (error) {
    if (missing(error)) throw new Error("Stories are not open on the database yet.");
    throw new Error("Could not add your story.");
  }
}

export async function publishPost(input: {
  uri: string;
  kind: "photo" | "video";
  caption: string;
  productId?: string | null;
  journeyId?: string | null;
  attachCard?: boolean;
  label?: string | null;
}) {
  const uid = await userId();
  const path = await upload(input.uri, input.kind);
  const { error } = await client()
    .from("unmask_expressions")
    .insert({
      user_id: uid,
      media_path: path,
      media_kind: input.kind,
      caption: input.caption.trim().slice(0, 500),
      product_id: input.productId || null,
      journey_id: input.journeyId || null,
      attach_card: Boolean(input.attachCard),
      attach_label: input.label || null,
    });
  if (error) {
    if (missing(error)) throw new Error("Posts are not open on the database yet.");
    throw new Error("Could not share that post.");
  }
}

type CardRow = {
  user_id: string;
  skin: string | null;
  hair: string | null;
  routine: string | null;
  goals: string | null;
  concerns: string[] | null;
};

type JourneyRow = {
  id: string;
  visibility: string;
  unmask_catalog?: { name?: string | null } | { name?: string | null }[] | null;
};

function productName(row: JourneyRow) {
  const catalog = Array.isArray(row.unmask_catalog) ? row.unmask_catalog[0] : row.unmask_catalog;
  return catalog?.name?.trim() || "A product";
}

async function sharedJourneys(id: string, own: boolean) {
  if (!supabase) return [];
  let query = supabase
    .from("unmask_journeys")
    .select("id,visibility,unmask_catalog:unmask_catalog!unmask_journeys_product_id_fkey(name)")
    .eq("user_id", id)
    .order("updated_at", { ascending: false })
    .limit(8);
  if (!own) query = query.eq("visibility", "public");
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as JourneyRow[]).filter((row) => own || row.visibility === "public");
}

export async function loadCard(id: string, own: boolean, name: string, handle?: string | null, avatarUrl?: string | null): Promise<UnmaskCard> {
  let saved: CardRow | null = null;
  if (supabase) {
    const { data, error } = await supabase.from("unmask_cards").select("user_id,skin,hair,routine,goals,concerns").eq("user_id", id).maybeSingle();
    if (!error) saved = data as CardRow | null;
  }
  const journeys = await sharedJourneys(id, own);
  const publicJourneys = journeys.filter((row) => row.visibility === "public");
  return composeCard({
    userId: id,
    name,
    handle,
    avatar: avatarUrl ? { uri: avatarUrl } : null,
    skin: saved?.skin,
    hair: saved?.hair,
    routine: saved?.routine,
    goals: saved?.goals,
    concerns: saved?.concerns,
    products: publicJourneys.map((row) => ({ id: row.id, name: productName(row) })),
    timelines: publicJourneys.map((row) => ({ id: row.id, label: productName(row) })),
  });
}

export async function saveCard(input: {
  skin: string;
  hair: string;
  routine: string;
  goals: string;
  concerns: string[];
}) {
  const uid = await userId();
  const blank = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };
  const { error } = await client()
    .from("unmask_cards")
    .upsert({
      user_id: uid,
      skin: blank(input.skin),
      hair: blank(input.hair),
      routine: blank(input.routine),
      goals: blank(input.goals),
      concerns: input.concerns.map((item) => item.trim()).filter(Boolean).slice(0, 8),
      updated_at: new Date().toISOString(),
    });
  if (error) {
    if (missing(error)) throw new Error("Your card is not open on the database yet.");
    throw new Error("Could not save your Unmask.");
  }
}

export async function voteMoment(momentId: string, choice: "a" | "b") {
  const uid = await userId();
  const { error } = await client().from("unmask_moment_votes").insert({ moment_id: momentId, voter_id: uid, choice });
  if (error && !missing(error) && !/duplicate|23505/i.test(error.message ?? "")) {
    throw new Error("Could not keep that choice.");
  }
}
