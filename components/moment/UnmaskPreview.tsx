import { Image, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSaved, hapticSelect } from "@/lib/haptics";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import type { MomentContext } from "./MomentComplete";

export function UnmaskPreview({
  kind,
  mediaUri,
  context,
  onPost,
}: {
  kind: MomentKind;
  mediaUri: string;
  context: MomentContext;
  onPost: (destination: "post" | "story" | "both") => void;
}) {
  const router = useRouter();
  const config = momentConfig(kind);
  const evening = kind === "evening";
  const bg = evening ? "#140B12" : "#F9F5EB";
  const ink = evening ? "#FFF8F4" : "#2D1B1B";

  const contextLine = [
    context.routineTag,
    context.occasion,
    context.usageDuration,
    context.productName,
  ]
    .filter(Boolean)
    .join(" · ");

  async function shareExternal() {
    hapticSelect();
    try {
      await Share.share({ message: `My ${config.title} on Unmask — context before conclusion.` });
    } catch {
      /* cancelled */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 28, color: ink, textAlign: "center" }}>Your Unmask is ready ✨</Text>

          <View style={{ borderRadius: livelyRadii.hero, overflow: "hidden" }}>
            <Image source={{ uri: mediaUri }} style={{ width: "100%", height: 380 }} resizeMode="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={["transparent", evening ? "rgba(10,4,8,0.85)" : "rgba(45,27,27,0.55)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 8 }}>
              <Text style={{ fontFamily: fonts.serifBold, fontSize: 22, color: "#FFF8F4" }}>
                {config.title} {config.emoji}
              </Text>
              {context.eveningSteps ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,248,244,0.9)" }}>{context.eveningSteps}</Text>
              ) : null}
              {contextLine ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,248,244,0.75)" }}>{contextLine}</Text> : null}
              {context.experience ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "#FFF8F4" }}>&ldquo;{context.experience}&rdquo;</Text>
              ) : null}
            </LinearGradient>
          </View>

          <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, color: evening ? "#F0CF69" : "#9A7B4F", textAlign: "center" }}>SHARE YOUR UNMASK</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {["WhatsApp", "Instagram", "TikTok", "Snapchat"].map((label) => (
              <Pressable key={label} onPress={() => void shareExternal()} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: evening ? "rgba(255,255,255,0.2)" : "#E8D4D4" }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: ink }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => { hapticSelect(); onPost("both"); }} style={{ borderRadius: 999, overflow: "hidden" }}>
            <LinearGradient colors={["#FF6B9D", "#70323E"]} style={{ paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Post to Unmask</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => { hapticSaved("moment"); onPost("story"); }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink, textAlign: "center" }}>Story only</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/" as Href)}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: evening ? "rgba(255,248,244,0.6)" : "#746B66", textAlign: "center" }}>Save for later</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}