import { View, Text } from "react-native";
import { VideoTrack, useTracks, isTrackReference, type TrackReferenceOrPlaceholder } from "@livekit/react-native";
import { Track } from "livekit-client";
import { fonts } from "@/constants/theme";

export function LiveVideoStage({ layout = "panel", stageTags = {} }: { participants: any[]; localParticipant: any; layout?: "panel" | "grid"; stageTags?: Record<string, string> }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: true }], { onlySubscribed: true });
  const active = tracks.filter((item): item is TrackReferenceOrPlaceholder => isTrackReference(item));
  const screen = active.find((item: any) => item.source === Track.Source.ScreenShare);
  const cameras = active.filter((item: any) => item.source === Track.Source.Camera);
  if (!active.length) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}><Text style={{ color: "#F2D25B", fontFamily: fonts.semibold, fontSize: 13 }}>UNMASK LIVE</Text><Text style={{ color: "#E9D8E0", fontFamily: fonts.regular, fontSize: 12 }}>Waiting for video…</Text></View>;
  const Tile = ({ ref, compact = false }: { ref: any; compact?: boolean }) => <View style={{ flex: compact ? undefined : 1, width: compact ? 104 : undefined, minHeight: compact ? 116 : 180, borderRadius: 16, overflow: "hidden", backgroundColor: "#24131B" }}><VideoTrack trackRef={ref} style={{ width: "100%", height: "100%" }} /><View style={{ position: "absolute", left: 7, bottom: 7, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "#10070BCC" }}><Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 10 }}>{stageTags[ref.participant?.identity] || ref.participant?.name || "Guest"}</Text></View></View>;
  if (screen) return <View style={{ flex: 1, gap: 8, padding: 8 }}><View style={{ flex: 1 }}><Tile ref={screen} /></View>{cameras.length ? <View style={{ height: 112, flexDirection: "row", gap: 8 }}>{cameras.slice(0,4).map((ref:any)=><Tile key={ref.publication?.trackSid || ref.participant?.identity} ref={ref} compact />)}</View> : null}</View>;
  if (layout === "grid" || cameras.length === 1) return <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8 }}>{cameras.slice(0,6).map((ref:any)=><View key={ref.publication?.trackSid || ref.participant?.identity} style={{ width: cameras.length === 1 ? "100%" : "48%", height: cameras.length <= 2 ? "100%" : "48%" }}><Tile ref={ref} /></View>)}</View>;
  return <View style={{ flex: 1, padding: 8, gap: 8 }}><View style={{ flex: 1 }}><Tile ref={cameras[0]} /></View>{cameras.length > 1 ? <View style={{ height: 112, flexDirection: "row", gap: 8 }}>{cameras.slice(1,5).map((ref:any)=><Tile key={ref.publication?.trackSid || ref.participant?.identity} ref={ref} compact />)}</View> : null}</View>;
}