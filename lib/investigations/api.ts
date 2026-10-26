import { db } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
export type Investigation = {
  id: string;
  user_id: string;
  product_id: string | null;
  question_id: string | null;
  experience_id: string | null;
  attached_journey_id?: string | null;
  attached_experience_id?: string | null;
  title: string;
  concern: string;
  supporting_links: string;
  status: "requested" | "selected" | "investigating" | "published";
  creator_id: string | null;
  findings: string;
  company_response: string;
  uncertainty: string;
  sources: string;
  video_url: string | null;
  commercial_disclosure?: string;
  spark_goal?: number;
  created_at: string;
};
export type Summary = {
  sparks: number;
  thunder: number;
  supporters: number;
  backers: { name: string; user_id: string; weight: number }[];
};
export type Receipt = {
  id: string;
  kind: "sparks" | "thunder";
  amount: number;
  public_ack: boolean;
  sparks: number;
  thunder: number;
  summary: Summary;
};
async function read<T>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
export const get = (id: string) =>
  read<Investigation>(
    db().from("unmask_investigations").select("*").eq("id", id).single(),
  );
export const list = (product?: string) => {
  let q = db()
    .from("unmask_investigations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  if (product) q = q.eq("product_id", product);
  return read<Investigation[]>(q);
};
export async function create(
  row: Pick<
    Investigation,
    | "title"
    | "concern"
    | "product_id"
    | "question_id"
    | "experience_id"
    | "supporting_links"
  > &
    Pick<Investigation, "attached_journey_id" | "attached_experience_id">,
) {
  await userId();
  return read<Investigation>(
    db().from("unmask_investigations").insert(row).select().single(),
  );
}
export const summary = (id: string) =>
  read<Summary>(db().rpc("investigation_support_summary", { p_id: id }));
export const updates = (id: string) =>
  read<{ id: string; body: string; created_at: string }[]>(
    db()
      .from("unmask_investigation_updates")
      .select("*")
      .eq("investigation_id", id)
      .order("created_at", { ascending: false }),
  );
export const wallet = async () =>
  read<{ sparks: number; thunder: number } | null>(
    db()
      .from("unmask_spark_wallets")
      .select("sparks,thunder")
      .eq("user_id", await userId())
      .maybeSingle(),
  );
export const contribute = (
  id: string,
  kind: "sparks" | "thunder",
  amount: number,
  publicAck: boolean,
  key: string,
) =>
  read<Receipt>(
    db().rpc("contribute_investigation", {
      p_id: id,
      p_kind: kind,
      p_amount: amount,
      p_public: publicAck,
      p_key: key,
    }),
  );
export function validAmount(kind: string, raw: string) {
  if (!["sparks", "thunder"].includes(kind) || !/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  return (
    Number.isSafeInteger(n) && n >= (kind === "sparks" ? 10 : 1) && n <= 1000000
  );
}

export async function setSparkGoal(id: string, goal: number) {
  if (!Number.isSafeInteger(goal) || goal < 10 || goal > 1000000)
    throw new Error("Choose a target between 10 and 1,000,000 Sparks.");
  await userId();
  return read(
    db()
      .from("unmask_investigations")
      .update({ spark_goal: goal })
      .eq("id", id)
      .select("id")
      .single(),
  );
}
