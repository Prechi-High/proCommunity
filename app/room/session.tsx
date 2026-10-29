import { useLocalSearchParams } from "expo-router";
import { RealtimeSession } from "@/components/realtime/RealtimeSession";

export default function RoomSession() {
  const { id, host } = useLocalSearchParams<{ id?: string; host?: string }>();
  return <RealtimeSession id={id || ""} mode="room" host={host === "1"} />;
}
