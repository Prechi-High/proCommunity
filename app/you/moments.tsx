import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft, DotsThree, Play, Sparkle } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { useAppStore } from "@/lib/store";
import { youVision } from "@/lib/vision/youTheme";

const FILTERS: { id: "all" | MomentKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "morning", label: "Morning ☀️" },
  { id: "grwm", label: "GRWM 💋" },
  { id: "evening", label: "Evening 🌙" },
];

export default function MyMoments() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const stories = useLocalMoments((s) => s.activeStories());
  const posts = useLocalMoments((s) => s.posts.filter((p) => p.momentKind && p.photo));
  const [filter, setFilter] = useState<"all" | MomentKind>("all");

  const journeys = useQuery({
    queryKey: ["living", "journeys", uid, "moments-using"],
    queryFn: living.journeys,
    enabled: !!uid,
  });
  const using = (journeys.data ?? []).filter((j) => j.status === "active" || j.status === "purchased").slice(0, 6);

  const items = [
    ...posts.map((p) => ({ id: p.id, photo: p.photo!, kind: p.momentKind, views: 0 })),
    ...stories.map((s) => ({ id: s.id, photo: s.media, kind: s.momentKind, views: s.likes })),
  ].filter((item) => (filter === "all" ? true : item.kind === filter));

  return (
    <View style={{ flex: 1, backgroundColor: youVision.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}>
          <ArrowLeft size={22} color={youVision.ink} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: youVision.ink }}>My Moments</Text>
        <Pressable style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <DotsThree size={24} color={youVision.ink} weight="bold" />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: youVision.radiusPill, backgroundColor: on ? youVision.maroon : youVision.chipIdleBg }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? "#FFF" : youVision.chipIdleInk }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 16 }}>
        {items.map((item) => {
          const config = item.kind ? momentConfig(item.kind) : null;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                hapticSelect();
                router.push(`/pulse/${item.id}` as Href);
              }}
              style={{ width: "48%", aspectRatio: 0.72, borderRadius: 16, overflow: "hidden", backgroundColor: youVision.chipIdleBg }}
            >
              <Image source={{ uri: item.photo }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
              <View style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
                <Play size={16} color="#FFF" weight="fill" />
              </View>
              <View style={{ position: "absolute", left: 8, right: 8, bottom: 8, padding: 6, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.5)" }}>
                <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF" }}>
                  {config ? `${config.emoji} ${config.title}` : "Moment"} · {item.views}
                </Text>
              </View>
            </Pressable>
          );
        })}
        </View>
        {using.length > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Sparkle size={16} color={youVision.maroon} weight="fill" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: youVision.ink }}>Currently Using</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {using.map((j) => (
                <Pressable
                  key={j.id}
                  onPress={() => router.push(`/journey/${j.id}` as Href)}
                  style={{ width: 72, height: 72, borderRadius: 16, overflow: "hidden", backgroundColor: youVision.chipIdleBg }}
                >
                  {j.unmask_catalog?.image_url ? (
                    <Image source={{ uri: j.unmask_catalog.image_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}