import { useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { RoomPreview } from "@/components/room/RoomPreview";
import { useRoomDock } from "@/lib/room/dock";

export default function RoomSession() {
  const { id, host, preview } = useLocalSearchParams<{ id?: string; host?: string; preview?: string }>();
  const open = useRoomDock((state) => state.open);
  const router = useRouter();
  const once = useRef(false);

  useEffect(() => {
    if (preview || !id || once.current) return;
    once.current = true;
    open({ id, host: host === "1" });
    if (router.canGoBack()) router.back();
    else router.replace("/room");
  }, [host, id, open, preview, router]);

  if (preview === "1" || preview === "prejoin") return <RoomPreview screen="prejoin" />;
  if (preview === "live") return <RoomPreview screen="live" />;
  if (preview === "host") return <RoomPreview screen="host" />;
  if (preview === "replies" || preview === "card" || preview === "timeline" || preview === "ultra" || preview === "spark") {
    return <RoomPreview screen={preview} />;
  }
  return null;
}
