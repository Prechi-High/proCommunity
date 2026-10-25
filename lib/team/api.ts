import { db } from "@/lib/clarity/api";
import type { Submission, Material, Earning, Payout } from "@/lib/creator/api";
export async function read<T>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as T;
}
export const access = () => read<boolean>(db().rpc("cw_admin"));
export type QueueItem = {
  id: string;
  title: string;
  concern: string;
  product_id: string | null;
  product_name: string | null;
  product_image: string | null;
  creator_id: string | null;
  status: string;
  sparks: number;
  thunder: number;
  supporters: number;
  accepted: boolean;
};
export const queue = (status: string, sort: string, offset = 0) =>
  read<QueueItem[]>(
    db().rpc("team_queue", {
      p_status: status,
      p_sort: sort,
      p_offset: offset,
    }),
  );
export type TeamCreator = {
  user_id: string;
  display_name: string;
  handle: string;
  bio: string;
  specialties: string[];
  avatar_url: string | null;
  published: boolean;
};
export const creators = () =>
  read<TeamCreator[]>(
    db().from("unmask_creators").select("*").order("display_name"),
  );
export const cases = () =>
  read<
    { id: string; title: string; creator_id: string | null; status: string }[]
  >(
    db()
      .from("unmask_investigations")
      .select("id,title,creator_id,status")
      .order("created_at", { ascending: false })
      .limit(300),
  );
export const assign = (id: string, creator: string, status: string) =>
  read(
    db()
      .from("unmask_investigations")
      .update({ creator_id: creator || null, status })
      .eq("id", id)
      .select("id")
      .single(),
  );
export type Research = {
  id: string;
  investigation_id: string;
  kind: string;
  label: string;
  notes: string;
  scheduled_at: string | null;
  status: string;
  recording_consent: boolean;
  publication_approved: boolean;
};
export const research = (id: string) =>
  read<Research[]>(
    db()
      .from("unmask_team_research")
      .select("*")
      .eq("investigation_id", id)
      .order("created_at", { ascending: false }),
  );
export const materials = (id: string) =>
  read<(Material & { approved: boolean })[]>(
    db()
      .from("unmask_creator_materials")
      .select("*")
      .eq("investigation_id", id),
  );
export const brief = (id: string) =>
  read<{ scope: string; permissions: string; due_on: string | null } | null>(
    db()
      .from("unmask_creator_briefs")
      .select("*")
      .eq("investigation_id", id)
      .maybeSingle(),
  );
export const reviews = () =>
  read<
    (Submission & {
      summary: string;
      narrative: string;
      sources: string;
      response: string;
      disclosure: string;
    })[]
  >(
    db()
      .from("unmask_creator_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  );
export const decide = (
  id: string,
  decision: string,
  feedback: string,
  checks: Record<string, boolean>,
) =>
  read(
    db().rpc("team_review", {
      p_id: id,
      p_decision: decision,
      p_feedback: feedback,
      p_checks: checks,
    }),
  );
export type PublicationData = {
  video_url: string;
  thumbnail_url: string;
  findings: string;
  company_response: string;
  uncertainty: string;
  sources: string;
};
export const plan = (id: string) =>
  read<{
    payload: PublicationData;
    scheduled_for: string | null;
    published_at: string | null;
  } | null>(
    db()
      .from("unmask_publication_plans")
      .select("*")
      .eq("submission_id", id)
      .maybeSingle(),
  );
export const publish = (
  id: string,
  data: PublicationData,
  when: string | null,
  now: boolean,
) =>
  read(
    db().rpc("team_publish", {
      p_id: id,
      p_data: data,
      p_when: when,
      p_publish: now,
    }),
  );
export type Report = {
  id: string;
  target_kind: "experience" | "reply" | "question";
  target_id: string;
  reason: string;
  status: string;
  decision: string | null;
  decision_reason: string | null;
  created_at: string;
};
export const reports = () =>
  read<Report[]>(
    db()
      .from("unmask_content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  );
export const moderate = (
  id: string,
  decision: string,
  reason: string,
  notify: boolean,
) =>
  read(
    db().rpc("team_moderate", {
      p_id: id,
      p_decision: decision,
      p_reason: reason,
      p_notify: notify,
    }),
  );
export const reportContent = (kind: string, id: string, reason: string) =>
  read(
    db()
      .from("unmask_content_reports")
      .insert({ target_kind: kind, target_id: id, reason })
      .select("id")
      .single(),
  );
export type Offer = {
  id: string;
  sponsor: string;
  title: string;
  product_id: string;
  kind: string;
  description: string;
  disclosure: string;
  terms: string;
  store_url: string | null;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  unmask_catalog: {
    name: string;
    brand: string | null;
    category: string | null;
    image_url: string | null;
  } | null;
};
export function offers(publicOnly = true) {
  let q = db()
    .from("unmask_offers")
    .select("*,unmask_catalog(name,brand,category,image_url)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (publicOnly) {
    const now = new Date().toISOString();
    q = q
      .eq("status", "active")
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`);
  }
  return read<Offer[]>(q);
}
export const offer = (id: string) =>
  read<Offer>(
    db()
      .from("unmask_offers")
      .select("*,unmask_catalog(name,brand,category,image_url)")
      .eq("id", id)
      .single(),
  );
export const teamEarnings = () =>
  read<
    (Earning & {
      creator_id: string;
      funding_source: string | null;
      funding_reference: string | null;
    })[]
  >(
    db()
      .from("unmask_creator_earnings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
  );
export const teamPayouts = () =>
  read<(Payout & { creator_id: string })[]>(
    db()
      .from("unmask_creator_payouts")
      .select("*")
      .order("paid_at", { ascending: false })
      .limit(100),
  );
export const recordPayout = (
  creator: string,
  earnings: string[],
  reference: string,
  receipt: string,
) =>
  read<string>(
    db().rpc("team_record_payout", {
      p_creator: creator,
      p_earnings: earnings,
      p_reference: reference,
      p_receipt: receipt || null,
    }),
  );
export const contributions = () =>
  read<
    {
      id: string;
      investigation_id: string;
      amount: number;
      kind: string;
      created_at: string;
    }[]
  >(
    db()
      .from("unmask_spark_contributions")
      .select("id,investigation_id,amount,kind,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  );
export const audit = () =>
  read<{ id: string; action: string; entity_id: string; created_at: string }[]>(
    db()
      .from("unmask_team_audit")
      .select("id,action,entity_id,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  );
export const tickets = () =>
  read<
    {
      id: string;
      subject: string;
      reference: string;
      message: string;
      status: string;
      created_at: string;
    }[]
  >(
    db()
      .from("unmask_support_requests")
      .select("id,subject,reference,message,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  );
export function dateTime(value: string) {
  if (!value.trim()) return null;
  const normalized = /([zZ]|[+-]\d\d:\d\d)$/.test(value)
    ? value
    : value + "+01:00";
  if (Number.isNaN(Date.parse(normalized)))
    throw new Error("Use YYYY-MM-DDTHH:mm, in Lagos time.");
  return new Date(normalized).toISOString();
}
