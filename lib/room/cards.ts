/** Room cards travel on the LiveKit data channel. They never rewrite session metadata. */

export type TimelineMoment = {
  id: string;
  at: string;
  note: string;
  reaction?: string | null;
  photoPath?: string | null;
  photoUrl?: string | null;
};

export type RoomTimeline = {
  id: string;
  productName: string;
  brand?: string | null;
  imageUrl?: string | null;
  duration: string;
  outcome: string;
  reactions: string[];
  author: string;
  entries: TimelineMoment[];
};

export type UltraPath = "why" | "company" | "expert";

export const ULTRA_PATHS: Array<{ id: UltraPath; label: string; detail: string; concern: string }> = [
  { id: "why", label: "Why it happens", detail: "Follow it to the cause.", concern: "Why does this happen with this product?" },
  { id: "company", label: "Ask the company", detail: "Put the question to the brand.", concern: "Ask the company what they know about this." },
  { id: "expert", label: "Ask an expert", detail: "Bring in someone who knows.", concern: "Ask an expert to look at this experience." },
];

export type RoomUltra = {
  id: string;
  title: string;
  path: UltraPath;
  productName: string;
  sparks: number;
  goal: number;
  supporters: { name: string }[];
  author: string;
  pinned: boolean;
  timelineId?: string;
  imageUrl?: string | null;
};

export function journeyDuration(started?: string | null, now = Date.now()) {
  if (!started) return "In progress";
  const then = Date.parse(started);
  if (!Number.isFinite(then)) return "In progress";
  const days = Math.max(0, Math.round((now - then) / 86400000));
  if (days < 1) return "Started today";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.max(1, Math.round(days / 7))} weeks`;
  return `${Math.max(1, Math.round(days / 30))} months`;
}

export function timelineFromJourney(
  journey: {
    id: string;
    started_on?: string | null;
    goal?: string | null;
    status?: string | null;
    frequency?: string | null;
    acquisition?: string | null;
    unmask_catalog?: { name?: string | null; brand?: string | null; image_url?: string | null } | null;
  },
  author: string,
): RoomTimeline {
  return {
    id: journey.id,
    productName: journey.unmask_catalog?.name || "Product",
    brand: journey.unmask_catalog?.brand || null,
    imageUrl: journey.unmask_catalog?.image_url || null,
    duration: journeyDuration(journey.started_on),
    outcome: journey.goal || journey.status || "In progress",
    reactions: [journey.frequency, journey.acquisition].filter((item): item is string => !!item),
    author,
    entries: [],
  };
}

export function momentsFromUpdates(
  rows: Array<{ id: string; created_at?: string | null; changed?: string | null; reaction?: string | null; photo_path?: string | null }>,
): TimelineMoment[] {
  return rows
    .filter((row) => typeof row.id === "string" && typeof row.changed === "string" && row.changed.trim())
    .slice(0, 8)
    .map((row) => ({
      id: row.id.slice(0, 80),
      at: typeof row.created_at === "string" ? row.created_at : "",
      note: row.changed!.trim().slice(0, 280),
      reaction: row.reaction?.trim().slice(0, 40) || null,
      photoPath: row.photo_path?.trim().slice(0, 240) || null,
    }));
}

export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index < 0) return [...list, item];
  const next = list.slice();
  next[index] = { ...next[index], ...item };
  return next;
}

export function applySpark(
  list: RoomUltra[],
  update: { id: string; sparks: number; supporters: { name: string }[] },
): RoomUltra[] {
  return list.map((card) => {
    if (card.id !== update.id || update.sparks < card.sparks) return card;
    return { ...card, sparks: update.sparks, supporters: update.supporters };
  });
}

export function mergeUltra(list: RoomUltra[], card: RoomUltra): RoomUltra[] {
  const index = list.findIndex((entry) => entry.id === card.id);
  if (index < 0) return [...list, card];
  const current = list[index];
  const next = list.slice();
  next[index] = {
    ...current,
    ...card,
    sparks: Math.max(current.sparks, card.sparks),
    supporters: card.supporters.length >= current.supporters.length ? card.supporters : current.supporters,
    pinned: current.pinned || card.pinned,
  };
  return next;
}

export function ultraTitle(path: UltraPath, productName: string) {
  const label = ULTRA_PATHS.find((item) => item.id === path)?.label || "Ultra Unmask";
  const name = productName.trim() || "this product";
  const title = `${label}: ${name}`.replace(/\s+/g, " ").trim();
  if (title.length >= 10) return title.slice(0, 160);
  return `Ultra Unmask for ${name}`.slice(0, 160);
}

export function ultraConcern(path: UltraPath, outcome?: string | null) {
  const base = ULTRA_PATHS.find((item) => item.id === path)?.concern || "What should we look into?";
  const extra = outcome?.trim();
  return (extra ? `${base}\n\n${extra}` : base).slice(0, 3000);
}

export function pinUltra(list: RoomUltra[], id: string): RoomUltra[] {
  return list.map((card) => ({ ...card, pinned: card.id === id }));
}

export function isTimeline(value: unknown): value is RoomTimeline {
  if (!value || typeof value !== "object") return false;
  const row = value as RoomTimeline;
  return typeof row.id === "string" && typeof row.productName === "string" && typeof row.author === "string";
}

export function isUltra(value: unknown): value is RoomUltra {
  if (!value || typeof value !== "object") return false;
  const row = value as RoomUltra;
  return typeof row.id === "string" && typeof row.title === "string" && typeof row.sparks === "number" && typeof row.goal === "number";
}
