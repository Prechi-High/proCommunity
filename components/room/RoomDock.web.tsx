import { View } from "react-native";

/**
 * Realtime rooms use the native/full LiveKit implementation on native
 * platforms. The web shell does not mount the room dock until a room is
 * opened, so keep the global dock lightweight and avoid loading the heavy
 * realtime session into the initial web bundle.
 */
export function RoomDock() {
  return <View pointerEvents="none" style={{ display: "none" }} />;
}
