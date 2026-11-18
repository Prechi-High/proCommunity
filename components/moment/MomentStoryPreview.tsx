import { Image, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, ImageSquare, PencilSimple, Sparkle } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

import type { MomentContext } from "./MomentComplete";
import { LoopClip } from "../social/LoopClip";

export function MomentStoryPreview({
  kind,
  mediaUri,
  mediaKind,
  context,
  onBack,
  onNext,
}: {
  kind: MomentKind;
  mediaUri: string;
  mediaKind: "photo" | "video";
  context: MomentContext;
  onBack: () => void;
  onNext: () => void;
}) {
  const { height } = useWindowDimensions();
  const config = momentConfig(kind);
  const occasion = context.occasion || "Date Night";
  const productCount = context.products?.length || (context.productName ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A14" }}>
      <SafeAreaView edges={["top"]} style={{ position: "absolute", zIndex: 2, left: 0, right: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color="#FFF8F4" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 17, color: "#FFF8F4" }}>Preview</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      {mediaKind === "video" ? (
        <LoopClip uri={mediaUri} poster={mediaUri} height={height} />
      ) : (
        <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
      )}

      <View pointerEvents="none" style={{ position: "absolute", top: 56, left: 16 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: "#FFF8F4" }}>Unmask</Text>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: 100, right: 16, gap: 8, alignItems: "flex-end" }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(74,30,60,0.85)" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>
            {config.title} {config.emoji}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(74,30,60,0.85)" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>{occasion.toUpperCase()} ♡</Text>
        </View>
      </View>

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 120,
          padding: 14,
          borderRadius: 16,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#FFF8F4" }}>Tonight&apos;s lineup</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,248,244,0.85)", marginTop: 4 }}>
          My routine • {productCount || 6} products
        </Text>
      </View>

      <SafeAreaView edges={["bottom"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 14 }}>
          {[
            { label: "Edit", Icon: PencilSimple },
            { label: "Filters", Icon: Sparkle },
            { label: "Text", text: "Aa" },
            { label: "Cover", Icon: ImageSquare },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => hapticSelect()}
              style={{ alignItems: "center", gap: 4 }}
            >
              {"text" in item ? (
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: "#FFF8F4" }}>{item.text}</Text>
              ) : (
                <item.Icon size={22} color="#FFF8F4" />
              )}
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#FFF8F4" }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            hapticSelect();
            onNext();
          }}
          style={{ marginHorizontal: 20, marginBottom: 12, paddingVertical: 16, borderRadius: 999, backgroundColor: "#4A1E3C", alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Continue →</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}