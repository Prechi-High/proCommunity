import { View } from "react-native";

import { RealtimeSession } from "@/components/realtime/RealtimeSession";
import { useRoomDock } from "@/lib/room/dock";

/** Keeps the Room sheet above whatever screen is open, including when it is minimized. */
export function RoomDock() {
  const active = useRoomDock((state) => state.active);
  if (!active) return null;
  return (
    <View
      pointerEvents={active.minimized ? "box-none" : "auto"}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}
    >
      <RealtimeSession id={active.id} mode="room" host={active.host} />
    </View>
  );
}
