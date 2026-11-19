import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, Handbag, Plus, Waveform, X } from "@/components/icons";
import { CreatorToolSheets, type CreatorToolKind } from "@/components/moment/CreatorToolSheets";
import { LoopClip } from "@/components/social/LoopClip";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import { momentFlow } from "@/lib/moment/flowTheme";
import { GRWM_OCCASIONS, USAGE_DURATION, momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { playStudioSound, stopStudioSound, UNMASK_IMAGE_BGM_MAX_SEC } from "@/lib/moment/studioAudio";
import {
  displayOccasion,
  productCount,
  type CreatorSettings,
  type MomentContext,
  type MomentMediaAsset,
} from "@/lib/moment/types";

/**
 * Fullscreen edit: media fills the frame; products, context, and (for photos) sound overlay.
 */
export function MomentEditScreen({
  kind,
  productStory,
  mediaUri,
  mediaKind,
  mediaAssets,
  creator,
  context,
  processing,
  processingLabel,
  onCreatorChange,
  onContextChange,
  onOpenProducts,
  onAddSlide,
  onMediaAssetsChange,
  onBack,
  onNext,
}: {
  kind: MomentKind;
  productStory?: boolean;
  mediaUri: string;
  mediaKind: "photo" | "video";
  mediaAssets: MomentMediaAsset[];
  creator: CreatorSettings;
  context: MomentContext;
  processing?: boolean;
  processingLabel?: string;
  onCreatorChange: (c: CreatorSettings) => void;
  onContextChange: (c: MomentContext) => void;
  onOpenProducts: () => void;
  onAddSlide?: () => void;
  onMediaAssetsChange?: (assets: MomentMediaAsset[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { height } = useWindowDimensions();
  const config = momentConfig(kind);
  const [toolOpen, setToolOpen] = useState<CreatorToolKind>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = mediaAssets.length > 1 ? mediaAssets.filter((a) => a.kind === "photo") : [];
  const activeUri = slides[slideIndex]?.uri || mediaUri;
  const sound = selectedSoundLabel(creator);
  const occasion = displayOccasion(context);
  const products = context.products ?? [];
  const isPhoto = mediaKind === "photo";
  const title = productStory ? "My Product Story" : `${config.title} ${config.emoji}`;

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!isPhoto || !sound) {
        await stopStudioSound();
        return;
      }
      // Published-style loop on the edit canvas so creators hear what status will feel like
      await playStudioSound(creator, {
        loop: true,
        maxMs: UNMASK_IMAGE_BGM_MAX_SEC * 1000,
      });
      if (!alive) await stopStudioSound();
    })();
    return () => {
      alive = false;
      void stopStudioSound();
    };
  }, [creator.soundId, creator.localSoundUri, isPhoto, sound]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0610" }}>
      {mediaKind === "video" ? (
        <LoopClip uri={activeUri} poster={activeUri} height={height} />
      ) : (
        <Image source={{ uri: activeUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
      )}

      {/* Soft bottom so controls stay readable */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "42%",
          backgroundColor: "transparent",
        }}
      />

      <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color="#FFF8F4" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>{title}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Live branding strip — matches what status/export will show */}
        <View style={{ position: "absolute", top: 64, left: 16, right: 16, gap: 8 }} pointerEvents="none">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: "rgba(255,248,244,0.95)" }}>Unmask</Text>
          {(occasion || products.length > 0) && (
            <View style={{ gap: 4 }}>
              {occasion ? (
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF8F4" }}>{occasion}</Text>
              ) : null}
              {products.slice(0, 3).map((p) => (
                <Text key={p.productId} style={{ fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,248,244,0.9)" }}>
                  {p.brand ? `${p.brand} · ${p.name}` : p.name}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />

        {slides.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
            {slides.map((s, i) => (
              <Pressable key={s.id} onPress={() => setSlideIndex(i)} style={{ borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: i === slideIndex ? "#FF6B9D" : "transparent" }}>
                <Image source={{ uri: s.uri }} style={{ width: 52, height: 72 }} accessibilityIgnoresInvertColors />
              </Pressable>
            ))}
            {onAddSlide ? (
              <Pressable
                onPress={onAddSlide}
                style={{ width: 52, height: 72, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center" }}
              >
                <Plus size={22} color="#FFF8F4" />
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: 14, gap: 10, paddingBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip
              label={productCount(context) ? `Products (${productCount(context)})` : "Add product"}
              active={productCount(context) > 0}
              onPress={onOpenProducts}
              icon={<Handbag size={14} color="#FFF8F4" weight="fill" />}
            />
            {isPhoto ? (
              <Chip
                label={sound ? sound : "Add sound"}
                active={Boolean(sound)}
                onPress={() => setToolOpen("music")}
                icon={<Waveform size={14} color="#FFF8F4" weight="fill" />}
              />
            ) : null}
            {isPhoto && onAddSlide && slides.length <= 1 ? (
              <Chip label="Add slides" onPress={onAddSlide} icon={<Plus size={14} color="#FFF8F4" />} />
            ) : null}
          </ScrollView>

          <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            {!productStory && kind === "grwm" ? (
              <FieldLabel label="Occasion">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {GRWM_OCCASIONS.map((o) => (
                    <Chip
                      key={o}
                      label={o}
                      active={context.occasion === o}
                      onPress={() => onContextChange({ ...context, occasion: o })}
                    />
                  ))}
                </ScrollView>
                {context.occasion === "My Own" ? (
                  <TextInput
                    value={context.customOccasion ?? ""}
                    onChangeText={(customOccasion) => onContextChange({ ...context, customOccasion })}
                    placeholder="Your occasion"
                    placeholderTextColor="rgba(255,248,244,0.45)"
                    style={inputStyle}
                  />
                ) : null}
              </FieldLabel>
            ) : null}

            {!productStory && (kind === "morning" || kind === "evening" || kind === "currently") ? (
              <FieldLabel label="How long using">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {USAGE_DURATION.map((u) => (
                    <Chip
                      key={u}
                      label={u}
                      active={context.usageDuration === u}
                      onPress={() => onContextChange({ ...context, usageDuration: u })}
                    />
                  ))}
                </ScrollView>
              </FieldLabel>
            ) : null}

            {productStory ? (
              <>
                <FieldLabel label="Your experience">
                  <TextInput
                    value={context.experience ?? ""}
                    onChangeText={(experience) => onContextChange({ ...context, experience })}
                    placeholder="What changed for you?"
                    placeholderTextColor="rgba(255,248,244,0.45)"
                    multiline
                    style={[inputStyle, { minHeight: 72, textAlignVertical: "top" }]}
                  />
                </FieldLabel>
                <FieldLabel label="Confidence">
                  <TextInput
                    value={context.confidence ?? ""}
                    onChangeText={(confidence) => onContextChange({ ...context, confidence })}
                    placeholder="How sure are you about this?"
                    placeholderTextColor="rgba(255,248,244,0.45)"
                    style={inputStyle}
                  />
                </FieldLabel>
              </>
            ) : (
              <FieldLabel label="Caption / note">
                <TextInput
                  value={context.experience ?? ""}
                  onChangeText={(experience) => onContextChange({ ...context, experience })}
                  placeholder="Add a short note…"
                  placeholderTextColor="rgba(255,248,244,0.45)"
                  style={inputStyle}
                />
              </FieldLabel>
            )}

            {products.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {products.map((p) => (
                  <View
                    key={p.productId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingLeft: 10,
                      paddingRight: 6,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: "rgba(74,21,44,0.85)",
                    }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#FFF8F4" }} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Pressable
                      onPress={() =>
                        onContextChange({
                          ...context,
                          products: products.filter((x) => x.productId !== p.productId),
                          productName: products.filter((x) => x.productId !== p.productId)[0]?.name,
                        })
                      }
                      hitSlop={8}
                    >
                      <X size={14} color="#FFF8F4" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {processing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <ActivityIndicator color="#FF8BC8" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,248,244,0.85)" }}>
                {processingLabel || "Preparing Unmask…"}
              </Text>
            </View>
          ) : null}

          <Pressable
            disabled={processing}
            onPress={() => {
              hapticSelect();
              onNext();
            }}
            style={{
              marginTop: 4,
              paddingVertical: 16,
              borderRadius: momentFlow.radiusPill,
              backgroundColor: processing ? "rgba(255,107,157,0.45)" : momentFlow.accent,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <CreatorToolSheets
        open={toolOpen}
        creator={creator}
        onClose={() => setToolOpen(null)}
        onChange={onCreatorChange}
        mediaKind={mediaKind}
      />
    </View>
  );
}

const inputStyle = {
  marginTop: 8,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderRadius: 14,
  backgroundColor: "rgba(0,0,0,0.45)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.15)",
  fontFamily: fonts.regular,
  fontSize: 15,
  color: "#FFF8F4",
} as const;

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "rgba(255,248,244,0.7)" }}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? "rgba(74,21,44,0.95)" : "rgba(0,0,0,0.45)",
        borderWidth: 1,
        borderColor: active ? "#FF8BC8" : "rgba(255,255,255,0.2)",
      }}
    >
      {icon}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
