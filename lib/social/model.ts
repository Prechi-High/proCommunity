/** Pure social objects. No network, so the feed rules can be tested on their own. */

export type MediaSource = number | { uri: string };

export type AttachKind = "card" | "product" | "timeline";

export type Attachment = {
  kind: AttachKind;
  id: string;
  label: string;
  detail?: string;
};

export type Poll = {
  prompt: string;
  a: string;
  b: string;
};

export type Moment = {
  id: string;
  authorId: string;
  author: string;
  handle: string;
  avatar: MediaSource | null;
  media: MediaSource;
  mediaKind: "photo" | "video";
  caption: string;
  createdAt: string;
  expiresAt: string;
  sample: boolean;
  attach?: Attachment;
  poll?: Poll;
};

export type Expression = {
  id: string;
  authorId: string;
  author: string;
  handle: string;
  avatar: MediaSource | null;
  media: MediaSource;
  mediaKind: "photo" | "video";
  caption: string;
  createdAt: string;
  sample: boolean;
  attach?: Attachment;
};

export type CardProduct = {
  id: string;
  name: string;
};

export type CardTimeline = {
  id: string;
  label: string;
};

export type UnmaskCard = {
  userId: string;
  name: string;
  handle: string;
  avatar: MediaSource | null;
  skin?: string;
  hair?: string;
  routine?: string;
  concerns: string[];
  goals?: string;
  products: CardProduct[];
  timelines: CardTimeline[];
  sample: boolean;
};

export type RailPerson = {
  authorId: string;
  author: string;
  avatar: MediaSource | null;
  sample: boolean;
  moments: Moment[];
};

export type MomentRow = {
  id: string;
  user_id: string;
  media_kind: "photo" | "video";
  caption: string | null;
  attach_kind: AttachKind | null;
  attach_id: string | null;
  attach_label: string | null;
  poll_prompt: string | null;
  poll_a: string | null;
  poll_b: string | null;
  created_at: string;
  expires_at: string;
};

export type ExpressionRow = {
  id: string;
  user_id: string;
  media_kind: "photo" | "video";
  caption: string | null;
  product_id: string | null;
  journey_id: string | null;
  attach_card: boolean | null;
  attach_label: string | null;
  created_at: string;
};

export type PersonRow = {
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
};

const HIDDEN_PHASES = new Set(["Ultra Unmask Reveal", "Seller Audio Room Reveal"]);

/** Day 71+ stays "The next layer" on screen. The calendar name is unchanged underneath. */
export function publicPhaseLabel(name: string): string {
  return HIDDEN_PHASES.has(name) ? "The next layer" : name;
}

export function activeMoments(moments: readonly Moment[], now = Date.now()): Moment[] {
  return moments.filter((moment) => {
    const expires = Date.parse(moment.expiresAt);
    return Number.isFinite(expires) && expires > now;
  });
}

export function railFromMoments(moments: readonly Moment[]): RailPerson[] {
  const order: string[] = [];
  const map = new Map<string, RailPerson>();
  for (const moment of moments) {
    const current = map.get(moment.authorId);
    if (!current) {
      order.push(moment.authorId);
      map.set(moment.authorId, {
        authorId: moment.authorId,
        author: moment.author,
        avatar: moment.avatar,
        sample: moment.sample === true,
        moments: [moment],
      });
      continue;
    }
    current.moments.push(moment);
    if (moment.sample !== true) current.sample = false;
  }
  return order.map((id) => map.get(id)!);
}

export function splitSamples<T extends { sample: boolean }>(items: readonly T[]) {
  return {
    live: items.filter((item) => item.sample !== true),
    samples: items.filter((item) => item.sample === true),
  };
}

/** Live people are never called samples, even when a sample rail is on the same page. */
export function sampleMark(item: { sample: boolean }): "Sample" | null {
  return item.sample === true ? "Sample" : null;
}

export function personUnseen(person: RailPerson, seen: ReadonlySet<string>): boolean {
  return person.moments.some((moment) => !seen.has(moment.id));
}

function personMedia(url?: string | null): MediaSource | null {
  return url ? { uri: url } : null;
}

function attachment(kind: AttachKind | null, id: string | null, label: string | null): Attachment | undefined {
  if (!kind || !id) return undefined;
  return { kind, id, label: label || (kind === "card" ? "My Unmask" : "Open") };
}

export function momentFromRow(row: MomentRow, person: PersonRow | undefined, mediaUrl: string): Moment {
  const poll =
    row.poll_prompt && row.poll_a && row.poll_b
      ? { prompt: row.poll_prompt, a: row.poll_a, b: row.poll_b }
      : undefined;
  return {
    id: row.id,
    authorId: row.user_id,
    author: person?.display_name?.trim() || "Unmasker",
    handle: person?.handle?.trim() || "",
    avatar: personMedia(person?.avatar_url),
    media: { uri: mediaUrl },
    mediaKind: row.media_kind === "video" ? "video" : "photo",
    caption: row.caption?.trim() || "",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    sample: false,
    attach: attachment(row.attach_kind, row.attach_id, row.attach_label),
    poll,
  };
}

export function expressionFromRow(row: ExpressionRow, person: PersonRow | undefined, mediaUrl: string): Expression {
  let attach: Attachment | undefined;
  if (row.attach_card) {
    attach = { kind: "card", id: row.user_id, label: "My Unmask" };
  } else if (row.journey_id) {
    attach = { kind: "timeline", id: row.journey_id, label: row.attach_label || "Product timeline" };
  } else if (row.product_id) {
    attach = { kind: "product", id: row.product_id, label: row.attach_label || "What they use" };
  }
  return {
    id: row.id,
    authorId: row.user_id,
    author: person?.display_name?.trim() || "Unmasker",
    handle: person?.handle?.trim() || "",
    avatar: personMedia(person?.avatar_url),
    media: { uri: mediaUrl },
    mediaKind: row.media_kind === "video" ? "video" : "photo",
    caption: row.caption?.trim() || "",
    createdAt: row.created_at,
    sample: false,
    attach,
  };
}

export function composeCard(input: {
  userId: string;
  name: string;
  handle?: string | null;
  avatar?: MediaSource | null;
  skin?: string | null;
  hair?: string | null;
  routine?: string | null;
  goals?: string | null;
  concerns?: string[] | null;
  products?: CardProduct[];
  timelines?: CardTimeline[];
}): UnmaskCard {
  return {
    userId: input.userId,
    name: input.name.trim() || "Unmasker",
    handle: input.handle?.trim() || "",
    avatar: input.avatar ?? null,
    skin: input.skin?.trim() || undefined,
    hair: input.hair?.trim() || undefined,
    routine: input.routine?.trim() || undefined,
    goals: input.goals?.trim() || undefined,
    concerns: (input.concerns ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
    products: input.products ?? [],
    timelines: input.timelines ?? [],
    sample: false,
  };
}

export function boardMoments(live: readonly Moment[], samples: readonly Moment[], now = Date.now()) {
  const open = activeMoments(live, now);
  return open.length ? open : activeMoments(samples, now);
}

export function boardPosts(live: readonly Expression[], samples: readonly Expression[]) {
  return live.length ? live : samples;
}

export function usingSamples(liveCount: number): boolean {
  return liveCount === 0;
}
