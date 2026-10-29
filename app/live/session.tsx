import { useLocalSearchParams } from "expo-router";
import { RealtimeSession } from "@/components/realtime/RealtimeSession";

export default function LiveSession() {
  const { id, host } = useLocalSearchParams<{ id?: string; host?: string }>();
  return <RealtimeSession id={id || ""} mode="live" host={host === "1"} />;
}
