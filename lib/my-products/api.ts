import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, type Experience } from "@/lib/clarity/api";
import { userId } from "@/lib/living/api";
export const statusLabels: Record<string, string> = {
  active: "Currently using",
  repurchased: "Currently using",
  paused: "Paused use",
  purchased: "Not started",
  finished: "Previously used",
  stopped: "Previously used",
  replaced: "Previously used",
};
export type Followup = {
  id: string;
  experience_id: string;
  duration: string;
  usage_status: string;
  body: string;
  created_at: string;
};
export async function followups() {
  const { data, error } = await db()
    .from("clarity_experience_followups")
    .select("id,experience_id,duration,usage_status,body,created_at")
    .eq("user_id", await userId())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Followup[];
}
export type Draft = {
  key: string;
  target: string;
  body: string;
  duration: string;
};
export async function drafts(uid: string) {
  const prefix = `unmask:experience-draft:${uid}:`;
  const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
    k.startsWith(prefix),
  );
  const values = await AsyncStorage.multiGet(keys);
  return values.flatMap(([key, raw]) => {
    try {
      const d = JSON.parse(raw || "null");
      return d && typeof d.body === "string" && d.body.trim()
        ? [
            {
              key,
              target: key.slice(prefix.length),
              body: d.body,
              duration: typeof d.duration === "string" ? d.duration : "",
            },
          ]
        : [];
    } catch {
      return [];
    }
  }) as Draft[];
}
export type ActivityItem = {
  id: string;
  type: string;
  product_id: string;
  title: string;
  body: string;
  route: string;
  date: string;
};
export async function followedActivity(ids: string[]) {
  if (!ids.length) return [];
  const client = db();
  const results = await Promise.all([
    client
      .from("clarity_experiences")
      .select("id,product_id,author_name,body,created_at")
      .eq("visibility", "public")
      .eq("moderation_status", "visible")
      .in("product_id", ids)
      .order("created_at", { ascending: false })
      .limit(40),
    client
      .from("clarity_experience_followups")
      .select(
        "id,body,created_at,clarity_experiences!inner(id,product_id,author_name)",
      )
      .eq("clarity_experiences.visibility", "public")
      .eq("clarity_experiences.moderation_status", "visible")
      .in("clarity_experiences.product_id", ids)
      .order("created_at", { ascending: false })
      .limit(40),
    client
      .from("unmask_investigations")
      .select("id,product_id,title,findings,created_at")
      .eq("status", "published")
      .in("product_id", ids)
      .order("created_at", { ascending: false })
      .limit(40),
    client
      .from("unmask_questions")
      .select("id,product_id,body,created_at")
      .is("routine_id", null)
      .in("product_id", ids)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  for (const r of results) if (r.error) throw new Error(r.error.message);
  const [experiences, updates, investigations, questions] = results;
  return [
    ...(experiences.data ?? []).map((e) => ({
      id: `experience-${e.id}`,
      type: "New experience",
      product_id: e.product_id,
      title: e.author_name,
      body: e.body,
      route: `/contribute?experience=${e.id}`,
      date: e.created_at,
    })),
    ...(updates.data ?? []).map((u) => {
      const e = u.clarity_experiences as unknown as Experience;
      return {
        id: `update-${u.id}`,
        type: "Experience follow-up",
        product_id: e.product_id,
        title: e.author_name,
        body: u.body,
        route: `/contribute?experience=${e.id}`,
        date: u.created_at,
      };
    }),
    ...(investigations.data ?? []).map((i) => ({
      id: `investigation-${i.id}`,
      type: "Published investigation",
      product_id: i.product_id!,
      title: i.title,
      body: i.findings,
      route: `/investigation/${i.id}`,
      date: i.created_at,
    })),
    ...(questions.data ?? []).map((q) => ({
      id: `question-${q.id}`,
      type: "New community question",
      product_id: q.product_id!,
      title: q.body,
      body: "Share your experience in this discussion.",
      route: `/question/${q.id}`,
      date: q.created_at,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)) as ActivityItem[];
}
export type LegacyEntry = {
  id: string;
  journey_id: string;
  changed: string;
  visibility: string;
  created_at: string;
  unmask_journeys: {
    product_id: string;
    unmask_catalog: {
      name: string;
      brand: string | null;
      image_url: string | null;
    } | null;
  };
};
export async function legacyEntries() {
  const { data, error } = await db()
    .from("unmask_experience_updates")
    .select(
      "id,journey_id,changed,visibility,created_at,unmask_journeys!inner(product_id,unmask_catalog:unmask_catalog!unmask_journeys_product_id_fkey(name,brand,image_url))",
    )
    .eq("user_id", await userId())
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data as unknown as LegacyEntry[];
}
