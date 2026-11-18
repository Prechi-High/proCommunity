import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";

import { Bell, Camera, Fire, Sparkle } from "@/components/icons";
import { TrendJoinSheet } from "@/components/moment/TrendJoinSheet";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { SAMPLE_TRENDS } from "@/lib/moment/creatorCatalog";
import { CREATE_UNMASK_OPTIONS } from "@/lib/moment/createOptions";
import { momentFlow } from "@/lib/moment/flowTheme";
import { MOMENTS, type MomentKind } from "@/lib/moment/kinds";

const thumbs: Record<string, string> = Object.fromEntries(MOMENTS.map((m) => [m.id, m.cardImage]));
thumbs["product-story"] =
  "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=400&q=80";

export function ChooseMoment({
  onPick,
  onProductStory,
  onBack,
  onStartCamera,
  onJoinTrend,
}: {
  onPick: (kind: MomentKind) => void;
  onProductStory?: () => void;
  onBack?: () => void;
  onStartCamera?: () => void;
  onJoinTrend?: (trendId: string) => void;
}) {
  const router = useRouter();
  const [trendsOpen, setTrendsOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: onBack ? 4 : 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: momentFlow.ink }}>
            Unmask<Text style={{ color: momentFlow.accent }}>+</Text>
          </Text>
          <Pressable
            onPress={() => router.push("/notifications" as Href)}
            accessibilityLabel="Notifications"
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Bell size={22} color={momentFlow.ink} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {onBack ? (
            <Pressable onPress={onBack} style={{ marginBottom: 8, alignSelf: "flex-start" }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: momentFlow.muted }}>← Back</Text>
            </Pressable>
          ) : null}
          <View style={{ paddingTop: 8, gap: 10, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, color: momentFlow.ink, letterSpacing: -0.6 }}>
                What are you Unmasking today?
              </Text>
              <Sparkle size={22} color={momentFlow.accent} weight="fill" />
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: momentFlow.muted }}>
              Capture your routine, share your experience, and build your product story.
            </Text>
          </View>

          <View style={{ marginBottom: 16, gap: 10 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: momentFlow.ink }}>Trending</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {SAMPLE_TRENDS.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    hapticSelect();
                    onJoinTrend?.(t.id);
                  }}
                  style={{
                    width: 160,
                    padding: 12,
                    borderRadius: momentFlow.radiusCard,
                    backgroundColor: momentFlow.card,
                    borderWidth: 1,
                    borderColor: momentFlow.accentSoft,
                    gap: 6,
                  }}
                >
                  <Fire size={18} color={momentFlow.accent} weight="fill" />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: momentFlow.ink }}>{t.title}</Text>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted }}>
                    {t.prompt}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setTrendsOpen(true)}
                style={{
                  width: 120,
                  padding: 12,
                  borderRadius: momentFlow.radiusCard,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: momentFlow.accent,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.accent, textAlign: "center" }}>Join a trend</Text>
              </Pressable>
            </ScrollView>
          </View>

          <View style={{ gap: 12 }}>
            {CREATE_UNMASK_OPTIONS.map((row) => {
              const thumb = row.kind === "moment" ? thumbs[row.id] : thumbs["product-story"];
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  onPress={() => {
                    hapticSelect();
                    if (row.kind === "experience") {
                      if (onProductStory) onProductStory();
                      else router.push("/contribute" as Href);
                      return;
                    }
                    onPick(row.id);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    padding: 14,
                    borderRadius: momentFlow.radiusCard,
                    backgroundColor: momentFlow.card,
                    borderWidth: 1,
                    borderColor: "rgba(74,30,60,0.08)",
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: momentFlow.pillPink,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{row.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: momentFlow.ink, letterSpacing: 0.3 }}>
                      {row.title.toUpperCase()}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted }}>{row.subtitle}</Text>
                  </View>
                  <Image source={{ uri: thumb }} style={{ width: 72, height: 72, borderRadius: 14 }} accessibilityIgnoresInvertColors />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Pressable
          onPress={() => {
            hapticSelect();
            if (onStartCamera) onStartCamera();
            else onPick("grwm");
          }}
          style={{
            marginHorizontal: 20,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            paddingVertical: 16,
            borderRadius: momentFlow.radiusPill,
            borderWidth: 1.5,
            borderColor: momentFlow.accent,
            backgroundColor: momentFlow.card,
          }}
        >
          <Camera size={22} color={momentFlow.accent} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: momentFlow.accent }}>Start from Camera</Text>
        </Pressable>
      </SafeAreaView>

      <TrendJoinSheet
        open={trendsOpen}
        onClose={() => setTrendsOpen(false)}
        onJoin={(t) => onJoinTrend?.(t.id)}
      />
    </View>
  );
}