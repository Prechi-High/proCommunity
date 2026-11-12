import { useLocalSearchParams } from "expo-router";
import { PausedLayer } from "@/components/movement/PausedLayer";
import { RealtimeSession } from "@/components/realtime/RealtimeSession";
import { features } from "@/lib/features";

function LiveSessionScreen() {
  const { id, host, invite } = useLocalSearchParams<{ id?: string; host?: string; invite?: string }>();
  return <RealtimeSession id={id || ""} mode="live" host={host === "1"} inviteId={invite || undefined} />;
}

export default function LiveSession() {
  if (!features.live) return <PausedLayer surface="live" />;
  return <LiveSessionScreen />;
}
