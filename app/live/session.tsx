import { useLocalSearchParams } from "expo-router";
import { RealtimeSession } from "@/components/realtime/RealtimeSession";

export default function LiveSession() {
  const { id, host, invite } = useLocalSearchParams<{ id?: string; host?: string; invite?: string }>();
  return <RealtimeSession id={id || ""} mode="live" host={host === "1"} inviteId={invite || undefined} />;
}
