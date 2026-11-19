import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { MOMENTS, momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { useLocalMoments, type StoryItem } from "@/lib/moment/localPosts";
import { PREVIEW_MOMENTS, type PulseMoment } from "@/lib/social/previewMoments";
import { previewKindFor } from "@/lib/social/storyMomentMap";
import { useRoomTone } from "@/lib/social/roomTone";

import { StoryStatusRail } from "./StoryStatusRail";
import { StoryViewer } from "./StoryViewer";

export function UpdatesFeed() {
  const tone = useRoomTone();
  const stories = useLocalMoments((s) => s.stories);
  const pruneStories = useLocalMoments((s) => s.pruneStories);
  const [sectionQueue, setSectionQueue] = useState<PulseMoment[]>([]);

  useEffect(() => {
    pruneStories();
  }, [pruneStories]);

  const liveStories = useMemo(() => {
    const now = Date.now();
    return stories.filter((s) => new Date(s.expiresAt).getTime() > now);
  }, [stories]);

  const previewByKind = useMemo(() => {
    const map: Record<MomentKind, PulseMoment[]> = { morning: [], grwm: [], evening: [], currently: [] };
    for (const m of PREVIEW_MOMENTS) {
      const kind = previewKindFor(m.id);
      if (kind) map[kind].push(m);
    }
    for (const s of liveStories) {
      if (!s.momentKind) continue;
      map[s.momentKind].push(storyToPulse(s));
    }
    return map;
  }, [liveStories]);

  const openSection = (kind: MomentKind) => {
    const queue = previewByKind[kind];
    if (!queue.length) return;
    hapticSelect();
    setSectionQueue(queue);
  };

  return (
    <View style={{ gap: 20, paddingBottom: 24 }}>
      <StoryStatusRail />

      <View style={{ paddingHorizontal: 16, gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: tone.text }}>Browse by moment</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: tone.muted }}>
          Status vanishes after 24 hours. Tap a section to watch — like and reshare when viewing yours.
        </Text>
      </View>

      <View style={{ gap: 14, paddingHorizontal: 16 }}>
        {MOMENTS.map((m) => {
          const items = previewByKind[m.id];
          const cover = items[0]?.media || m.cardImage;
          return (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => openSection(m.id)} style={{ borderRadius: livelyRadii.card, overflow: "hidden" }}>
              <LinearGradient colors={[m.border[0], m.border[1]]} style={{ padding: 2 }}>
                <View style={{ borderRadius: livelyRadii.card - 2, overflow: "hidden", backgroundColor: "#140B12" }}>
                  <Image source={{ uri: cover }} style={{ width: "100%", height: 140 }} resizeMode="cover" accessibilityIgnoresInvertColors />
                  <LinearGradient colors={["transparent", "rgba(10,4,8,0.9)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 140 }} />
                  <View style={{ position: "absolute", left: 16, right: 16, bottom: 14, gap: 4 }}>
                    <Text style={{ fontFamily: fonts.serifBold, fontSize: 20, color: "#FFF8F4" }}>
                      {m.title} {m.emoji}
                    </Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,248,244,0.8)" }}>
                      {items.length} active now · {m.tagline}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>

      <StoryViewer visible={sectionQueue.length > 0} queue={sectionQueue} onClose={() => setSectionQueue([])} interactive />
    </View>
  );
}

function storyToPulse(s: StoryItem): PulseMoment {
  const label = s.momentKind ? momentConfig(s.momentKind).title : "Unmask";
  return {
    id: s.id,
    name: s.authorName || "Unmasker",
    face: "",
    media: s.mediaKind === "video" ? "" : s.media,
    video: s.mediaKind === "video" ? s.media : undefined,
    caption: s.caption || label,
    likes: s.likes,
    comments: 0,
    thread: [],
    invite: "24h status",
    storyId: s.id,
    occasion: s.occasion,
    productLabels: s.productLabels,
    soundUri: s.soundUri,
    soundMaxMs: s.soundMaxMs,
    stickers: s.momentKind ? [`${momentConfig(s.momentKind).title} ${momentConfig(s.momentKind).emoji}`] : undefined,
  };
}