import { db } from "@/lib/clarity/api";

export { foldRoomEvents, type RoomEventRow } from "./log";
import type { RoomEventRow } from "./log";

export async function joinRoom(sessionId: string) {
  const { error } = await db().rpc("unmask_room_join", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export async function loadRoomEvents(sessionId: string) {
  const { data, error } = await db()
    .from("unmask_room_events")
    .select("idempotency_key,author_name,kind,payload,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as RoomEventRow[];
}

export async function postRoomEvent(sessionId: string, kind: string, name: string, payload: unknown, key: string) {
  const { error } = await db().rpc("unmask_room_post", {
    p_session: sessionId,
    p_kind: kind,
    p_name: name,
    p_payload: payload,
    p_key: key,
  });
  if (error) throw new Error(error.message);
}
