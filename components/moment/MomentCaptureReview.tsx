import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft } from "@/components/icons";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import type { MomentKind } from "@/lib/moment/kinds";

import { LoopClip } from "../social/LoopClip";

export function MomentCaptureReview({
  mediaUri,
  mediaKind,
  onRetake,
  onNext,
}: {
  mediaUri: string;
  mediaKind: "photo" | "video";
  onRetake: () => void;
  onNext: (destination: "post" | "story" | "both") => void;
}) {
  const router = useRouter();
  const [destination, setDestination] = useState<"post" | "story" | "both">("both");

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0610" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 }}>
          <Pressable
            accessibilityLabel="Back home"
            onPress={() => router.replace("/")}
            style={{ width: 44, height: 44, justifyContent: "center" }}
          >
            <ArrowLeft size={22} color="#FFF8F4" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>
            Your capture
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1, marginHorizontal: 12, borderRadius: livelyRadii.hero, overflow: "hidden", backgroundColor: "#1A0A14" }}>
          {mediaKind === "video" ? (
            <LoopClip uri={mediaUri} poster={mediaUri} height={480} />
          ) : (
            <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
          )}
        </View>

        <View style={{ padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, color: "#F0CF69", textAlign: "center" }}>
            WHERE SHOULD IT GO?
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([
              { id: "story" as const, label: "Story" },
              { id: "post" as const, label: "Post" },
              { id: "both" as const, label: "Both" },
            ]).map((row) => (
              <Pressable
                key={row.id}
                onPress={() => {
                  hapticSelect();
                  setDestination(row.id);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 16,
                  alignItems: "center",
                  backgroundColor: destination === row.id ? "#FF6B9D" : "rgba(255,255,255,0.12)",
                  borderWidth: 1,
                  borderColor: destination === row.id ? "#FF6B9D" : "rgba(255,255,255,0.2)",
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>{row.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={onRetake}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, color: "#FFF8F4" }}>Retake</Text>
            </Pressable>
            <Pressable
              onPress={() => onNext(destination)}
              style={{
                flex: 1.4,
                paddingVertical: 14,
                borderRadius: 999,
                backgroundColor: "#70323E",
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, color: "#FFF8F4" }}>Next →</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
