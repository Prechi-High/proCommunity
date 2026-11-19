import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";

import { CaretRight } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { momentFlow } from "@/lib/moment/flowTheme";
import {
  defaultMomentTitle,
  displayOccasion,
  type MomentContext,
} from "@/lib/moment/types";
import { LoopClip } from "@/components/social/LoopClip";

/**
 * The "new image" card — media + Unmask brand + products + context.
 * Used in Preview, Share, and Status so the look stays identical.
 */
export function UnmaskMomentCard({
  kind,
  productStory,
  mediaUri,
  mediaKind,
  posterUri,
  context,
  caption,
  compact,
  playing,
}: {
  kind: MomentKind;
  productStory?: boolean;
  mediaUri: string;
  mediaKind: "photo" | "video";
  posterUri?: string;
  context: MomentContext;
  caption?: string;
  compact?: boolean;
  /** When false, video shows poster only (share thumb). Default true. */
  playing?: boolean;
}) {
  const { width } = useWindowDimensions();
  const config = momentConfig(kind);
  const cardW = Math.min(width - 40, 420);
  const mediaH = compact ? cardW * 0.72 : cardW * 0.95;
  const title = context.momentTitle?.trim() || defaultMomentTitle(kind, productStory, displayOccasion(context));
  const products = context.products ?? [];
  const shown = products.slice(0, 3);
  const extra = Math.max(0, products.length - shown.length);
  const badge = productStory ? "PRODUCT STORY 📖" : `${config.title} ${config.emoji}`;
  const duration = context.usageDuration;
  const skin = context.skinType;
  const usage = context.usageFrequency;
  const occasion = displayOccasion(context);
  const play = playing !== false;

  return (
    <View
      style={{
        width: cardW,
        alignSelf: "center",
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: momentFlow.accentSoft,
      }}
    >
      <View style={{ width: "100%", height: mediaH, backgroundColor: "#1A0A14" }}>
        {mediaKind === "video" && play ? (
          <LoopClip uri={mediaUri} poster={posterUri || mediaUri} height={mediaH} />
        ) : (
          <Image
            source={{ uri: posterUri || mediaUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        )}

        {/* Brand + moment badge */}
        <View style={{ position: "absolute", left: 12, top: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }} pointerEvents="none">
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#FFF8F4", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 4 }}>
              Unmask
            </Text>
            <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(74,21,44,0.88)" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF8F4" }}>{badge}</Text>
            </View>
          </View>
          {duration ? (
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: momentFlow.ink }}>{duration}</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <View style={{ position: "absolute", left: 16, right: 16, top: mediaH * 0.38 }} pointerEvents="none">
          <Text style={{ fontFamily: fonts.bold, fontSize: compact ? 22 : 28, color: "#FFF8F4", textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 6, lineHeight: compact ? 28 : 34 }}>
            {title.replace(/[☀️🌙💋✨📖]/g, "").trim()}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 18, color: "#FF6B9D" }}>♡</Text>
        </View>

        {/* Product strip */}
        {shown.length > 0 ? (
          <View
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: 8,
              borderRadius: 16,
              backgroundColor: "rgba(20,8,16,0.55)",
            }}
            pointerEvents="none"
          >
            {shown.map((p) => (
              <View key={p.productId} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
                {p.image ? (
                  <Image source={{ uri: p.image }} style={{ width: 28, height: 28, borderRadius: 8 }} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#F2D8D8" }} />
                )}
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 10, color: "#FFF8F4" }} numberOfLines={2}>
                  {p.name}
                </Text>
              </View>
            ))}
            {extra > 0 ? (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF8F4" }}>+{extra}</Text>
              </View>
            ) : null}
          </View>
        ) : products[0] || context.productName ? (
          <View
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "rgba(20,8,16,0.55)",
              maxWidth: "92%",
            }}
            pointerEvents="none"
          >
            {(products[0]?.image || context.productImage) ? (
              <Image
                source={{ uri: products[0]?.image || context.productImage }}
                style={{ width: 28, height: 28, borderRadius: 14 }}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <Text style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }} numberOfLines={1}>
              {products[0] ? (products[0].brand ? `${products[0].brand} ${products[0].name}` : products[0].name) : context.productName}
            </Text>
            <CaretRight size={14} color="#FFF8F4" />
          </View>
        ) : null}
      </View>

      {/* Context row */}
      <View style={{ flexDirection: "row", paddingHorizontal: 10, paddingVertical: 12, gap: 4, backgroundColor: "#FFF" }}>
        {[
          skin,
          usage,
          duration ? (duration.startsWith("Day") ? `${duration} of Use` : duration) : null,
          occasion || (productStory ? "Product Story" : config.title),
        ]
          .filter(Boolean)
          .slice(0, 4)
          .map((label) => (
            <View key={String(label)} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: momentFlow.muted, textAlign: "center" }} numberOfLines={2}>
                {label}
              </Text>
            </View>
          ))}
      </View>

      {caption?.trim() ? (
        <View style={{ marginHorizontal: 12, marginBottom: 14, padding: 12, borderRadius: 14, backgroundColor: momentFlow.pillPink }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: momentFlow.ink }}>
            “{caption.trim()}”
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Tiny reusable chip for share badges under media */
export function ContextBadge({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)" }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#FFF8F4" }}>{label}</Text>
    </View>
  );
}
