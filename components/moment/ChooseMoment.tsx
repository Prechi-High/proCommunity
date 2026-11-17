import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, Sparkle } from "@/components/icons";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { MOMENTS, type MomentKind } from "@/lib/moment/kinds";

export function ChooseMoment({ onPick }: { onPick: (kind: MomentKind) => void }) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#F9F5EB" }}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <Pressable accessibilityLabel="Back home" onPress={() => router.replace("/")} style={{ width: 44, height: 44, justifyContent: "center" }}>
            <ArrowLeft size={22} color="#2D1B1B" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <Sparkle size={18} color="#70323E" weight="fill" />
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 22, color: "#3D0F15", letterSpacing: -0.5 }}>Unmask</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
          <View style={{ gap: 8, paddingTop: 8 }}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 32, lineHeight: 38, color: "#2D1B1B", letterSpacing: -0.8 }}>
              What are you Unmasking?
            </Text>
            <View style={{ position: "absolute", right: 0, top: 4 }}>
              <Sparkle size={20} color="#70323E" weight="fill" />
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: "#9A7B4F" }}>Choose the moment you want to capture.</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "space-between" }}>
            {MOMENTS.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`${m.title} ${m.tagline}`}
                onPress={() => {
                  hapticSelect();
                  onPick(m.id);
                }}
                style={{ width: "47%", minHeight: 220 }}
              >
                <LinearGradient colors={[m.border[0], m.border[1]]} style={{ borderRadius: livelyRadii.card + 4, padding: 2, flex: 1 }}>
                  <View style={{ flex: 1, borderRadius: livelyRadii.card, overflow: "hidden", backgroundColor: "#FFFDF8" }}>
                    <Image source={{ uri: m.cardImage }} style={{ width: "100%", height: 120 }} resizeMode="cover" accessibilityIgnoresInvertColors />
                    <LinearGradient colors={["transparent", "rgba(45,27,27,0.75)"]} style={{ position: "absolute", left: 0, right: 0, top: 60, height: 60 }} />
                    <View style={{ padding: 12, gap: 4, flex: 1, justifyContent: "flex-end" }}>
                      <Text style={{ fontFamily: fonts.serifBold, fontSize: 15, color: "#2D1B1B" }}>
                        {m.title} {m.emoji}
                      </Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: "#5C534F" }}>{m.chooseSubtitle}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: "#746B66", textAlign: "center", paddingTop: 8 }}>
            Which version of you are we seeing today?
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}