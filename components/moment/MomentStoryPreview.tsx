import { Image, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, Handbag, ImageSquare, PencilSimple, Sparkle } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

import { displayOccasion, productCount, type MomentContext } from "@/lib/moment/types";
import { LoopClip } from "../social/LoopClip";

const LINEUP_MAX = 5;

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
  const occasion = (displayOccasion(context) || "Date Night").toUpperCase();
  const products = context.products ?? [];
  const count = productCount(context);
  const extra = Math.max(0, products.length - LINEUP_MAX);

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

      {/* Top-left wordmark */}
      <View pointerEvents="none" style={{ position: "absolute", top: 56, left: 16, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: "#FFF8F4" }}>Unmask</Text>
        <Sparkle size={14} color="#FFF8F4" weight="fill" />
      </View>

      {/* Bottom-left moment stickers (reference placement) */}
      <View pointerEvents="none" style={{ position: "absolute", left: 20, bottom: 210, gap: 10, maxWidth: "70%" }}>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 34, lineHeight: 38, color: "#FFF8F4", textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 8 }}>
          {config.title} {config.emoji}
        </Text>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.92)",
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.2, color: momentFlow.ink }}>
            {occasion} ♡
          </Text>
        </View>
      </View>

      {/* Tonight's lineup — glass card with product thumbs */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 168,
          padding: 14,
          borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.22)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
        }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "#FFF8F4" }}>Tonight&apos;s lineup</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          {products.slice(0, LINEUP_MAX).map((p) => (
            <View
              key={p.productId}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                overflow: "hidden",
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.85)",
                backgroundColor: "rgba(74,21,44,0.35)",
              }}
            >
              {p.image ? (
                <Image source={{ uri: p.image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : null}
            </View>
          ))}
          {products.length === 0 && context.productImage ? (
            <View style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.85)" }}>
              <Image source={{ uri: context.productImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
            </View>
          ) : null}
          {extra > 0 ? (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(74,21,44,0.65)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.5)",
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: "#FFF8F4" }}>+{extra}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Handbag size={16} color="#FFF8F4" weight="fill" />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,248,244,0.92)" }}>
            My routine • {count} product{count === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <SafeAreaView edges={["bottom"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)" }}>
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
          style={{ marginHorizontal: 20, marginBottom: 12, paddingVertical: 16, borderRadius: 999, backgroundColor: momentFlow.accent, alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Continue →</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}