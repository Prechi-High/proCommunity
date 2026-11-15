import { useEffect, useState } from "react";
import { View } from "react-native";

import { features } from "@/lib/features";
import { useRoomDock } from "@/lib/room/dock";

/** Keeps the Room sheet above whatever screen is open, including when it is minimized. */
export function RoomDock() {
  const active = useRoomDock((state) => state.active);
  const [Session, setSession] = useState<typeof import("@/components/realtime/RealtimeSession").RealtimeSession | null>(null);

  useEffect(() => {
    if (!features.audioRooms || !active) return;
    let alive = true;
    void import("@/components/realtime/RealtimeSession").then((mod) => {
      if (alive) setSession(() => mod.RealtimeSession);
    });
    return () => {
      alive = false;
    };
  }, [active]);

  if (!features.audioRooms || !active || !Session) return null;
  return (
    <View
      pointerEvents={active.minimized ? "box-none" : "auto"}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}
    >
      <Session id={active.id} mode="room" host={active.host} />
    </View>
  );
}
