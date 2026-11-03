import { useEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import type { Participant } from "livekit-client";
import { Track } from "livekit-client";
import { fonts } from "@/constants/theme";

type Tile = { key: string; participant: Participant; track: any; name: string; screen: boolean; tag?: string };

function VideoTile({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  const surface = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !surface.current || !tile.track?.attach) return;
    let element: any;
    try {
      element = tile.track.attach();
      element.autoplay = true;
      element.playsInline = true;
      element.muted = tile.track.source === Track.Source.Camera && tile.participant.isLocal;
      element.style.width = "100%";
      element.style.height = "100%";
      element.style.objectFit = tile.screen ? "contain" : "cover";
      element.style.position = "absolute";
      element.style.inset = "0";
      surface.current.appendChild(element);
      if (!element.muted) void element.play?.().catch?.(() => {});
    } catch {}
    return () => {
      try { if (element) { tile.track.detach(element); element.remove?.(); } } catch {}
    };
  }, [tile.track, tile.screen, tile.participant]);
  return (
    <View ref={surface} collapsable={false} style={{ flex: 1, minWidth: compact ? 104 : 0, minHeight: compact ? 116 : 180, borderRadius: 16, overflow: "hidden", backgroundColor: "#24131B", position: "relative", borderWidth: 1, borderColor: "#FFFFFF24" }}>
      {Platform.OS !== "web" ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontFamily: fonts.medium, fontSize: 11 }}>Native video renderer required</Text></View> : null}
      <View pointerEvents="none" style={{ position: "absolute", left: 7, bottom: 7, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "#10070BCC" }}>
        <Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 10 }}>{tile.screen ? "SCREEN · " : ""}{tile.tag || tile.name}</Text>
      </View>
    </View>
  );
}

export function LiveVideoStage({ participants, localParticipant, layout = "panel" }: {
  participants: Participant[];
  localParticipant: Participant;
  layout?: "panel" | "grid";
  stageTags?: Record<string, string>;
}) {
  const tiles = (() => {
    const people = [localParticipant, ...participants];
    const tags = stageTags || {};
    const result: Tile[] = [];
    for (const person of people) {
      for (const publication of person.videoTrackPublications.values()) {
        const track: any = publication.track;
        if (!track || track.kind !== Track.Kind.Video) continue;
        if (!person.isLocal && !publication.isSubscribed) continue;
        const screen = track.source === Track.Source.ScreenShare;
        result.push({
          key: person.identity + ":" + (track.sid || track.source),
          participant: person,
          track,
          name: person.name || (person.isLocal ? "You" : "Guest"),
          screen,
          tag: tags[person.identity],
        });
      }
    }
    result.sort((a, b) => Number(b.screen) - Number(a.screen));
    return result;
  })();

  const screen = tiles.find(tile => tile.screen);
  const cameras = tiles.filter(tile => !tile.screen);
  if (screen) {
    return (
      <View style={{ flex: 1, gap: 8, padding: 8 }}>
        <View style={{ flex: 1, minHeight: 180 }}><VideoTile tile={screen} /></View>
        {cameras.length ? <View style={{ height: 112, flexDirection: "row", gap: 8 }}>{cameras.slice(0, 4).map(tile => <VideoTile key={tile.key} tile={tile} compact />)}</View> : null}
      </View>
    );
  }
  if (!tiles.length) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}><Text style={{ color: "#F2D25B", fontFamily: fonts.semibold, fontSize: 13 }}>UNMASK LIVE</Text><Text style={{ color: "#E9D8E0", fontFamily: fonts.regular, fontSize: 12 }}>Waiting for the creator's camera…</Text></View>;
  }
  if (layout === "grid" || tiles.length === 1) {
    return <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8 }}>{tiles.slice(0, 6).map(tile => <View key={tile.key} style={{ width: tiles.length === 1 ? "100%" : "48%", height: tiles.length <= 2 ? "100%" : "48%" }}><VideoTile tile={tile} /></View>)}</View>;
  }
  return (
    <View style={{ flex: 1, padding: 8, gap: 8 }}>
      <View style={{ flex: 1 }}><VideoTile tile={tiles[0]} /></View>
      {tiles.length > 1 ? <View style={{ height: 112, flexDirection: "row", gap: 8 }}>{tiles.slice(1, 5).map(tile => <VideoTile key={tile.key} tile={tile} compact />)}</View> : null}
    </View>
  );
}
