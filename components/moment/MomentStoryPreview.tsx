import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, Handbag, ImageSquare, PencilSimple, Sparkle, Tag, Waveform } from "@/components/icons";
import { UnmaskPreviewFrame } from "@/components/moment/UnmaskPreviewFrame";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import { momentFlow } from "@/lib/moment/flowTheme";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

import { displayOccasion, productCount, type CreatorSettings, type MomentContext } from "@/lib/moment/types";
import { Image } from "react-native";

const LINEUP_MAX = 5;

export function MomentStoryPreview({
  kind,
  mediaUri,
  mediaKind,
  context,
  creator,
  coverPosterUri,
  onBack,
  onNext,
}: {
  kind: MomentKind;
  mediaUri: string;
  mediaKind: "photo" | "video";
  context: MomentContext;
  creator: CreatorSettings;
  coverPosterUri?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const config = momentConfig(kind);
  const occasionLabel = (displayOccasion(context) || "Date Night").toUpperCase();
  const products = context.products ?? [];
  const count = productCount(context);
  const extra = Math.max(0, products.length - LINEUP_MAX);

  const lineupItems =
    products.length > 0
      ? products
      : context.productImage
        ? [{ productId: "primary", name: context.productName || "Product", image: context.productImage }]
        : [];

  const toolbarHeight = 168 + insets.bottom;
  const soundLabel = selectedSoundLabel(creator);

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A14" }}>
      <UnmaskPreviewFrame mediaUri={mediaUri} mediaKind={mediaKind} creator={creator} soundLabel={soundLabel} posterUri={coverPosterUri}>
        <SafeAreaView edges={["top"]} style={{ position: "absolute", zIndex: 2, left: 0, right: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
            <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={22} color="#FFF8F4" />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 17, color: "#FFF8F4" }}>Preview</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>

        <View pointerEvents="none" style={{ position: "absolute", top: 52, left: 16, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#FFF8F4" }}>Unmask</Text>
          <Sparkle size={14} color="#FFF8F4" weight="fill" />
        </View>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: toolbarHeight,
            maxWidth: "100%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10, paddingRight: 8 }}>
            <Text
              style={{
                fontFamily: fonts.serifBold,
                fontSize: 34,
                lineHeight: 38,
                color: "#FFF8F4",
                textShadowColor: "rgba(0,0,0,0.5)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
              }}
            >
              {config.title}
            </Text>
            <Text style={{ fontSize: 26, marginBottom: 4, textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 4 }}>{config.emoji}</Text>
          </View>

          <View
            style={{
              alignSelf: "flex-start",
              marginBottom: 14,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.94)",
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, color: momentFlow.ink }} numberOfLines={1}>
              {occasionLabel} ♡
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.45)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
              alignSelf: "flex-start",
              maxWidth: "100%",
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4", marginRight: 4 }}>Tonight&apos;s lineup ({count})</Text>
            {lineupItems.slice(0, LINEUP_MAX).map((p) => (
              <View
                key={p.productId}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  overflow: "hidden",
                  borderWidth: 1.5,
                  borderColor: "rgba(255,255,255,0.9)",
                  backgroundColor: "rgba(74,21,44,0.4)",
                }}
              >
                {p.image ? (
                  <Image source={{ uri: p.image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
                ) : null}
              </View>
            ))}
            {extra > 0 ? (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(74,21,44,0.7)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1.5,
                  borderColor: "rgba(255,255,255,0.75)",
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: "#FFF8F4" }}>+{extra}</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => hapticSelect()}
            style={{ alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }}>Edit Cover</Text>
          </Pressable>
        </View>
      </UnmaskPreviewFrame>

      <SafeAreaView edges={["bottom"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 14 }}>
          {[
            { label: "Edit", Icon: PencilSimple, onPress: onBack },
            { label: "Looks", Icon: Sparkle, onPress: onBack },
            { label: "Text", text: "Aa" },
            { label: "Stickers", Icon: Tag },
            { label: "Music", Icon: Waveform, onPress: onBack },
            { label: "Cover", Icon: ImageSquare, onPress: onBack },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                hapticSelect();
                item.onPress?.();
              }}
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