import * as clarity from "@/lib/clarity/api";
import * as community from "@/lib/community-v2/api";
import * as living from "@/lib/living/api";
import type { Question } from "@/lib/living/types";
import { browse, type BrowseItem } from "@/lib/today/api";
import { publicUnmaskLabel, publicUnmaskStage } from "./status";

export type FeedKind = "experience" | "question" | "unmask";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  title: string;
  body: string;
  author: string;
  authorId?: string | null;
  sparkGoal?: number;
  sparkTargetId?: string;
  likes?: number;
  createdAt: string;
  productId?: string | null;
  productName?: string | null;
  productImage?: string | null;
  photo?: string | null;
  chips: string[];
  replies?: number;
  href: string;
  cta: string;
  status?: string;
  creatorName?: string | null;
  creatorAvatar?: string | null;
  sparks?: number;
  sample?: boolean;
  attachedJourneyId?: string | null;
  attachedExperienceId?: string | null;
};

function titleFromBody(body: string, fallback: string) {
  const t = body.replace(/\s+/g, " ").trim();
  if (!t) return fallback;
  const cut = t.slice(0, 90);
  return cut.length < t.length ? `${cut}…` : cut;
}

export function experienceToFeed(e: clarity.Experience): FeedItem {
  const chips = [e.duration, e.skin_type].filter(Boolean) as string[];
  return {
    id: `exp-${e.id}`,
    attachedJourneyId: e.attached_journey_id,
    attachedExperienceId: e.attached_experience_id,
    kind: "experience",
    title: titleFromBody(e.body, "A product experience"),
    body: e.body,
    author: e.author_name || "Unmasker",
    authorId: e.user_id,
    createdAt: e.created_at,
    productId: e.product_id,
    productName: e.unmask_catalog?.name,
    productImage: e.unmask_catalog?.image_url,
    photo: e.photo_path,
    chips,
    href: `/story/${e.id}`,
    cta: "Read what they lived",
  };
}

export function questionToFeed(
  q: Question,
  productName?: string,
  productImage?: string | null,
): FeedItem {
  return {
    id: `q-${q.id}`,
    kind: "question",
    title: titleFromBody(q.body, "A product question"),
    body: q.context || q.body,
    author: q.author_name || "Unmasker",
    authorId: q.user_id,
    createdAt: q.created_at,
    productId: q.product_id,
    productName,
    productImage,
    chips: productName ? [productName] : [],
    href: `/question/${q.id}`,
    cta: "Answer with what you lived",
  };
}

export function unmaskToFeed(row: BrowseItem): FeedItem {
  const stage = publicUnmaskStage(row.status);
  return {
    id: `unmask-${row.id}`,
    kind: "unmask",
    title: row.title,
    body: row.concern,
    author: row.creator_name || row.starter_name || "Community",
    authorId: row.creator_id || row.user_id,
    sparkGoal: row.spark_goal,
    createdAt: row.created_at,
    productId: row.product_id,
    productName: row.product_name,
    productImage: row.product_image,
    photo: row.product_image,
    chips: [publicUnmaskLabel(stage)],
    href: `/investigation/${row.id}`,
    cta:
      stage === "unmasked" ? "Watch the Ultra Unmask" : "See the Ultra Unmask",
    status: publicUnmaskLabel(stage),
    creatorName: row.creator_name,
    creatorAvatar: row.creator_avatar,
    sparks: (row.sparks ?? 0) + (row.thunder ?? 0) * 100,
  };
}

export async function loadHomeFeed(): Promise<FeedItem[]> {
  const [experiences, questions, unmasks, catalog] = await Promise.all([
    clarity.experiences(),
    living.questions(),
    browse("", "All", "Recent"),
    living.catalog(),
  ]);
  const names = new Map(catalog.map((p) => [p.id, p]));
  const items: FeedItem[] = [
    ...experiences.map(experienceToFeed),
    ...questions.map((q) =>
      questionToFeed(
        q,
        names.get(q.product_id || "")?.name,
        names.get(q.product_id || "")?.image_url,
      ),
    ),
    ...unmasks.map(unmaskToFeed),
  ];
  for (const item of items) {
    if (item.kind === "unmask") continue;
    const id = item.href.split("/").pop();
    const linked = unmasks.find((u) =>
      item.kind === "experience"
        ? u.experience_id === id
        : u.question_id === id,
    );
    if (linked) {
      item.sparkTargetId = linked.id;
      item.sparks = (linked.sparks ?? 0) + (linked.thunder ?? 0) * 100;
    }
  }
  items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return items;
}

export async function loadUnmasks(
  sort: "Recent" | "Most sparked" = "Recent",
): Promise<FeedItem[]> {
  const rows = await browse("", "All", sort);
  return rows.map(unmaskToFeed);
}

export { community };
