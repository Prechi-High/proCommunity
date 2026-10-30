import {
  applySpark,
  isTimeline,
  isUltra,
  mergeUltra,
  pinUltra,
  ULTRA_PATHS,
  type RoomTimeline,
  type RoomUltra,
  type UltraPath,
} from "./cards";

export type RoomChatNote = {
  id: string;
  name: string;
  text: string;
  experience?: RoomTimeline | null;
};

const PATHS = new Set(ULTRA_PATHS.map((item) => item.id));

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readTimeline(value: unknown): RoomTimeline | null {
  if (!isTimeline(value)) return null;
  const row = value as RoomTimeline;
  return {
    id: row.id.slice(0, 80),
    productName: row.productName.slice(0, 80),
    brand: clip(row.brand, 40) || null,
    imageUrl: clip(row.imageUrl, 400) || null,
    duration: clip(row.duration, 40) || "In progress",
    outcome: clip(row.outcome, 280),
    reactions: Array.isArray(row.reactions)
      ? row.reactions.filter((item): item is string => typeof item === "string").slice(0, 6).map((item) => item.slice(0, 40))
      : [],
    author: row.author.slice(0, 80),
  };
}

function readUltra(value: unknown): RoomUltra | null {
  if (!isUltra(value)) return null;
  const row = value as RoomUltra;
  if (!PATHS.has(row.path)) return null;
  const supporters = Array.isArray(row.supporters)
    ? row.supporters
        .map((person) => (person && typeof person.name === "string" ? { name: person.name.slice(0, 80) } : null))
        .filter((person): person is { name: string } => !!person?.name)
        .slice(0, 12)
    : [];
  return {
    id: row.id.slice(0, 80),
    title: row.title.slice(0, 160),
    path: row.path as UltraPath,
    productName: clip(row.productName, 80) || "Product",
    sparks: row.sparks,
    goal: row.goal,
    supporters,
    author: clip(row.author, 80) || "Unmasker",
    pinned: !!row.pinned,
    timelineId: clip(row.timelineId, 80) || undefined,
  };
}

export function applyRoomNote(notes: RoomChatNote[], raw: unknown, author: string): RoomChatNote[] {
  if (!raw || typeof raw !== "object") return notes;
  const item = raw as { type?: string; id?: unknown; text?: unknown; experience?: unknown };
  if (item.type !== "chat" || typeof item.id !== "string") return notes;
  if (notes.some((note) => note.id === item.id)) return notes;
  const text = clip(item.text, 500);
  const experience = item.experience == null ? null : readTimeline(item.experience);
  if (!text && !experience) return notes;
  return [...notes, { id: item.id.slice(0, 80), name: author.slice(0, 80) || "Unmasker", text: text || "Shared a product timeline.", experience }].slice(-40);
}

export function applyRoomUltras(list: RoomUltra[], raw: unknown): RoomUltra[] {
  if (!raw || typeof raw !== "object") return list;
  const item = raw as { type?: string; card?: unknown; id?: unknown; sparks?: unknown; supporters?: unknown };
  if (item.type === "ultra") {
    const card = readUltra(item.card);
    return card ? mergeUltra(list, card) : list;
  }
  if (item.type === "spark" && typeof item.id === "string" && typeof item.sparks === "number" && Number.isFinite(item.sparks)) {
    const supporters = Array.isArray(item.supporters)
      ? item.supporters
          .map((person) => {
            const name = person && typeof person === "object" ? clip((person as { name?: unknown }).name, 80) : "";
            return name ? { name } : null;
          })
          .filter((person): person is { name: string } => !!person)
          .slice(0, 12)
      : [];
    return applySpark(list, { id: item.id, sparks: item.sparks, supporters });
  }
  if (item.type === "pin" && typeof item.id === "string") return pinUltra(list, item.id);
  return list;
}
