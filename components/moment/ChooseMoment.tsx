import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Sparkle } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CREATE_UNMASK_OPTIONS } from "@/lib/moment/createOptions";
import { momentFlow } from "@/lib/moment/flowTheme";
import { MOMENTS, type MomentKind } from "@/lib/moment/kinds";

const thumbs: Record<string, string> = Object.fromEntries(MOMENTS.map((m) => [m.id, m.cardImage]));
thumbs["product-story"] =
  "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=400&q=80";

export function ChooseMoment({
  onPick,
  onProductStory,
}: {
  onPick: (kind: MomentKind) => void;
  onProductStory?: () => void;
}) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={{ paddingTop: 16, gap: 10, marginBottom: 20 }}>
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
      </SafeAreaView>
    </View>
  );
}