import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, CaretRight } from "@/components/icons";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CREATE_HERO_IMAGE, CREATE_UNMASK_OPTIONS } from "@/lib/moment/createOptions";
import type { MomentKind } from "@/lib/moment/kinds";

export function ChooseMoment({
  onPick,
  onProductStory,
}: {
  onPick: (kind: MomentKind) => void;
  onProductStory?: () => void;
}) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#4A1F35" }}>
      <LinearGradient colors={["#6B2D4F", "#C96B8A", "#E8A0B8"]} style={{ flex: 1 }}>
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 4 }}>
            <Pressable accessibilityLabel="Back home" onPress={() => router.replace("/")} style={{ width: 44, height: 44, justifyContent: "center" }}>
              <ArrowLeft size={22} color="#FFF8F4" />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>

          <View style={{ height: 200, overflow: "hidden" }}>
            <Image
              source={{ uri: CREATE_HERO_IMAGE }}
              style={{ width: "100%", height: 240, opacity: 0.92 }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={["transparent", "rgba(74,31,53,0.85)"]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, color: "#FFF8F4", letterSpacing: -0.6 }}>
                Create an Unmask
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: "rgba(255,248,244,0.88)" }}>
                Share a moment, your routine or a product experience.
              </Text>
            </View>

            <View style={{ gap: 12, marginTop: 8 }}>
              {CREATE_UNMASK_OPTIONS.map((row) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.title}. ${row.subtitle}`}
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
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: livelyRadii.card,
                    backgroundColor: "rgba(255,248,244,0.94)",
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      backgroundColor: "rgba(255,214,228,0.65)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>{row.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: "#2D1B1B" }}>{row.title}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: "#746B66" }}>{row.subtitle}</Text>
                  </View>
                  <CaretRight size={18} color="#9A7B4F" />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}