import { Image, Pressable, Share, Text, useWindowDimensions, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { InstagramLogo, Sparkle, TiktokLogo, WhatsappLogo } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { routineIconFor } from "@/lib/moment/routineIcons";

import type { MomentContext } from "./MomentComplete";
import { LoopClip } from "../social/LoopClip";

export function UnmaskPreview({
  kind,
  mediaUri,
  mediaKind,
  context,
  destination,
  onPost,
}: {
  kind: MomentKind;
  mediaUri: string;
  mediaKind: "photo" | "video";
  context: MomentContext;
  destination: "post" | "story" | "both";
  onPost: () => void;
}) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const config = momentConfig(kind);

  const contextLine = [context.productName, context.occasion, context.usageDuration].filter(Boolean).join(" · ");

  async function shareExternal() {
    hapticSelect();
    try {
      await Share.share({ message: `My ${config.title} on Unmask` });
    } catch {
      /* cancelled */
    }
  }

  const socials = [
    { Icon: WhatsappLogo, label: "WhatsApp" },
    { Icon: InstagramLogo, label: "Instagram" },
    { Icon: TiktokLogo, label: "TikTok" },
    { Icon: Sparkle, label: "Snapchat" },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {mediaKind === "video" ? (
        <LoopClip uri={mediaUri} poster={mediaUri} height={height} />
      ) : (
        <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
      )}

      <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]} pointerEvents="box-none">
        <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.75)"]} style={{ flex: 1, justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
          <View style={{ gap: 8, paddingTop: 8 }}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, color: "#FFF8F4", textAlign: "center" }}>Your Unmask is ready ✨</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FF8BC8", textAlign: "center" }}>
              {config.title} {config.emoji}
            </Text>
            {contextLine ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: "rgba(255,248,244,0.85)", textAlign: "center" }}>{contextLine}</Text>
            ) : null}
            {(context.routineTags ?? []).length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 }}>
                {(context.routineTags ?? []).map((tag) => {
                  const Icon = routineIconFor(tag);
                  return (
                    <View key={tag} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)" }}>
                      <Icon size={16} color="#FFF8F4" weight="fill" />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#FFF8F4" }}>{tag}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {context.experience ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,248,244,0.9)", textAlign: "center" }}>{context.experience}</Text>
            ) : null}
          </View>

          <View style={{ gap: 14, paddingBottom: 8 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2, color: "rgba(255,248,244,0.75)", textAlign: "center" }}>SHARE YOUR UNMASK</Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}>
              {socials.map(({ Icon, label }) => (
                <Pressable key={label} accessibilityLabel={`Share on ${label}`} onPress={() => void shareExternal()} style={{ alignItems: "center", gap: 6 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={28} color="#FFF8F4" weight="fill" />
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: "rgba(255,248,244,0.85)" }}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={onPost} style={{ borderRadius: 999, overflow: "hidden" }}>
              <LinearGradient colors={["#FF6B9D", "#70323E"]} style={{ paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                <Sparkle size={20} color="#FFF8F4" weight="fill" />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>
                  Post to Unmask{destination === "story" ? " · Story" : destination === "post" ? " · Feed" : ""}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => router.replace("/" as Href)}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,248,244,0.65)", textAlign: "center" }}>Not now</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </View>
  );
}