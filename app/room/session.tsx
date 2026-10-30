import { useLocalSearchParams } from "expo-router";

import { RealtimeSession } from "@/components/realtime/RealtimeSession";
import { RoomPreview } from "@/components/room/RoomPreview";

export default function RoomSession() {
  const { id, host, preview } = useLocalSearchParams<{ id?: string; host?: string; preview?: string }>();
  if (preview === "1" || preview === "host") return <RoomPreview host={preview === "host"} />;
  return <RealtimeSession id={id || ""} mode="room" host={host === "1"} />;
}
