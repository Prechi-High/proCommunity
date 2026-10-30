import type { RoomReactionKind } from "./types";

export const ROOM_EMOJIS: Array<{ id: RoomReactionKind; glyph: string; label: string }> = [
  { id: "laugh", glyph: "😂", label: "Laugh" },
  { id: "wow", glyph: "😮", label: "Surprised" },
  { id: "sad", glyph: "😢", label: "Sad" },
  { id: "heart", glyph: "💜", label: "Heart" },
  { id: "hundred", glyph: "💯", label: "100" },
  { id: "clap", glyph: "👏", label: "Clap" },
  { id: "fist", glyph: "✊", label: "Fist" },
  { id: "up", glyph: "👍", label: "Yes" },
  { id: "down", glyph: "👎", label: "No" },
  { id: "wave", glyph: "👋", label: "Wave" },
];

export const ROOM_EMOJI_IDS = ROOM_EMOJIS.map((item) => item.id);

export function roomEmoji(id: string) {
  return ROOM_EMOJIS.find((item) => item.id === id);
}
