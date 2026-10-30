import { applyRoomNote, applyRoomUltras, type RoomChatNote } from "./channel";
import type { RoomUltra } from "./cards";

export type RoomEventRow = {
  idempotency_key: string;
  author_name: string;
  kind: string;
  payload: unknown;
};

export function foldRoomEvents(rows: RoomEventRow[]) {
  let notes: RoomChatNote[] = [];
  let ultras: RoomUltra[] = [];
  let reactionCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.idempotency_key || seen.has(row.idempotency_key)) continue;
    seen.add(row.idempotency_key);
    const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
    if (row.kind === "chat") {
      notes = applyRoomNote(notes, {
        type: "chat",
        id: row.idempotency_key,
        text: payload.text,
        experience: payload.experience,
      }, row.author_name);
    } else if (row.kind === "reaction") {
      reactionCount += 1;
    } else if (row.kind === "ultra" || row.kind === "spark" || row.kind === "pin") {
      ultras = applyRoomUltras(ultras, { ...payload, type: row.kind });
    }
  }
  return { notes, ultras, reactionCount };
}
