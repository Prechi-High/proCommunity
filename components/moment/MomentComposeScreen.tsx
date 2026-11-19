import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, CaretDown, CaretRight, DotsThree, MapPin, PencilSimple, Plus, UsersThree } from "@/components/icons";
import { MomentStepper } from "@/components/moment/MomentStepper";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { SKIN_TYPES } from "@/lib/moment/creatorCatalog";
import { momentFlow } from "@/lib/moment/flowTheme";
import {
  GRWM_OCCASIONS,
  MOMENTS,
  USAGE_DURATION,
  USAGE_FREQUENCY,
  momentConfig,
  type MomentKind,
} from "@/lib/moment/kinds";
import {
  defaultMomentTitle,
  displayOccasion,
  productCount,
  type MomentContext,
  type MomentMediaAsset,
} from "@/lib/moment/types";
import { LoopClip } from "@/components/social/LoopClip";

const CAPTION_MAX = 220;

/**
 * Compose step — match mockup: media, title, caption, moment pills, products, context.
 */
export function MomentComposeScreen({
  kind,
  productStory,
  mediaUri,
  mediaKind,
  mediaAssets,
  context,
  caption,
  onKindChange,
  onContextChange,
  onCaptionChange,
  onOpenProducts,
  onBack,
  onNext,
  onRecapture,
}: {
  kind: MomentKind;
  productStory?: boolean;
  mediaUri: string;
  mediaKind: "photo" | "video";
  mediaAssets: MomentMediaAsset[];
  context: MomentContext;
  caption: string;
  onKindChange: (k: MomentKind) => void;
  onContextChange: (c: MomentContext) => void;
  onCaptionChange: (v: string) => void;
  onOpenProducts: () => void;
  onBack: () => void;
  onNext: () => void;
  onRecapture?: () => void;
}) {
  const config = momentConfig(kind);
  const products = context.products ?? [];
  const title = context.momentTitle?.trim() || defaultMomentTitle(kind, productStory, displayOccasion(context));
  const durationLabel = mediaAssets[0]?.durationMs
    ? `${Math.floor(mediaAssets[0].durationMs / 60000)}:${String(Math.floor((mediaAssets[0].durationMs % 60000) / 1000)).padStart(2, "0")}`
    : mediaKind === "video"
      ? "Video"
      : "Photo";

  const [picker, setPicker] = useState<null | "skin" | "usage" | "duration" | "occasion" | "title">(null);
  const [titleDraft, setTitleDraft] = useState(title);

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: momentFlow.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 4 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color={momentFlow.ink} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 20, color: momentFlow.ink }}>Unmask</Text>
          <Pressable style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <DotsThree size={22} color={momentFlow.ink} />
          </Pressable>
        </View>
        <MomentStepper active="compose" />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 18 }} keyboardShouldPersistTaps="handled">
        {/* Media + title + caption */}
        <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
          <Pressable onPress={onRecapture} style={{ width: 112, height: 140, borderRadius: 16, overflow: "hidden", backgroundColor: "#1A0A14" }}>
            {mediaKind === "video" ? (
              <LoopClip uri={mediaUri} poster={mediaAssets[0]?.posterUri || ""} height={140} />
            ) : (
              <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
            )}
            <View style={{ position: "absolute", left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.55)" }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: "#FFF8F4" }}>{durationLabel}</Text>
            </View>
            <View style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" }}>
              <PencilSimple size={14} color={momentFlow.accent} />
            </View>
          </Pressable>

          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, color: momentFlow.muted }}>YOUR UNMASK MOMENT</Text>
            <Pressable
              onPress={() => {
                setTitleDraft(title);
                setPicker("title");
              }}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}
            >
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: momentFlow.ink }}>{title}</Text>
              <PencilSimple size={16} color={momentFlow.muted} />
            </Pressable>
            <View style={{ borderRadius: 14, backgroundColor: momentFlow.card, borderWidth: 1, borderColor: momentFlow.accentSoft, padding: 10, minHeight: 88 }}>
              <TextInput
                value={caption}
                onChangeText={(v) => onCaptionChange(v.slice(0, CAPTION_MAX))}
                placeholder="Write a caption…"
                placeholderTextColor={momentFlow.muted}
                multiline
                style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: momentFlow.ink, minHeight: 56, textAlignVertical: "top" }}
              />
              <Text style={{ alignSelf: "flex-end", fontFamily: fonts.medium, fontSize: 11, color: momentFlow.muted }}>
                {caption.length}/{CAPTION_MAX}
              </Text>
            </View>
          </View>
        </View>

        {/* Moment type pills */}
        {!productStory ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {MOMENTS.map((m) => {
              const active = m.id === kind;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    hapticSelect();
                    onKindChange(m.id);
                    if (!context.momentTitle) {
                      onContextChange({
                        ...context,
                        momentTitle: defaultMomentTitle(m.id, false, displayOccasion(context)),
                      });
                    }
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: active ? momentFlow.pillPink : momentFlow.card,
                    borderWidth: 1.5,
                    borderColor: active ? momentFlow.accent : momentFlow.accentSoft,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{m.emoji}</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? momentFlow.accent : momentFlow.ink }}>
                    {m.id === "morning" ? "My Morning" : m.id === "evening" ? "My Evening" : m.id === "currently" ? "Currently Using" : m.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* GRWM occasion */}
        {kind === "grwm" && !productStory ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.ink }}>Getting ready for</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {GRWM_OCCASIONS.map((o) => {
                const active = context.occasion === o;
                return (
                  <Pressable
                    key={o}
                    onPress={() => {
                      hapticSelect();
                      onContextChange({ ...context, occasion: o });
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 999,
                      backgroundColor: active ? momentFlow.accent : momentFlow.card,
                      borderWidth: 1,
                      borderColor: active ? momentFlow.accent : momentFlow.accentSoft,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? "#FFF8F4" : momentFlow.ink }}>{o}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {context.occasion === "My Own" ? (
              <TextInput
                value={context.customOccasion ?? ""}
                onChangeText={(customOccasion) => onContextChange({ ...context, customOccasion })}
                placeholder="What are you getting ready for?"
                placeholderTextColor={momentFlow.muted}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: momentFlow.card,
                  borderWidth: 1,
                  borderColor: momentFlow.accentSoft,
                  fontFamily: fonts.regular,
                  fontSize: 15,
                  color: momentFlow.ink,
                }}
              />
            ) : null}
          </View>
        ) : null}

        {/* Products */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: momentFlow.ink }}>
              Products in this routine ({productCount(context)})
            </Text>
            <Pressable
              onPress={() => {
                hapticSelect();
                onOpenProducts();
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Plus size={16} color={momentFlow.accent} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.accent }}>Add Product</Text>
            </Pressable>
          </View>
          {products.length === 0 ? (
            <Pressable
              onPress={onOpenProducts}
              style={{
                padding: 18,
                borderRadius: 16,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: momentFlow.accent,
                alignItems: "center",
                backgroundColor: momentFlow.card,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.accent }}>Attach the products you’re using</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              {products.map((p) => (
                <View
                  key={p.productId}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: momentFlow.card,
                    borderWidth: 1,
                    borderColor: momentFlow.accentSoft,
                  }}
                >
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={{ width: 48, height: 48, borderRadius: 12 }} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: momentFlow.accentSoft }} />
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    {p.brand ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: momentFlow.muted }}>{p.brand}</Text> : null}
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }} numberOfLines={2}>
                      {p.name}
                    </Text>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#E23B3B", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#FFF", fontFamily: fonts.bold, fontSize: 12 }}>✓</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Context */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: momentFlow.ink }}>Your context (Optional)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ContextSelect
              label="Skin Type"
              value={context.skinType || "Select"}
              onPress={() => setPicker("skin")}
            />
            <ContextSelect
              label="Usage"
              value={context.usageFrequency || "Select"}
              onPress={() => setPicker("usage")}
            />
            <ContextSelect
              label="Duration"
              value={context.usageDuration || "Select"}
              onPress={() => setPicker("duration")}
            />
          </View>

          {productStory ? (
            <TextInput
              value={context.experience ?? ""}
              onChangeText={(experience) => onContextChange({ ...context, experience })}
              placeholder="What changed for you?"
              placeholderTextColor={momentFlow.muted}
              multiline
              style={{
                padding: 14,
                minHeight: 80,
                borderRadius: 16,
                backgroundColor: momentFlow.card,
                borderWidth: 1,
                borderColor: momentFlow.accentSoft,
                fontFamily: fonts.regular,
                fontSize: 15,
                color: momentFlow.ink,
                textAlignVertical: "top",
              }}
            />
          ) : null}

          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
              borderRadius: 16,
              backgroundColor: momentFlow.card,
              borderWidth: 1,
              borderColor: momentFlow.accentSoft,
            }}
          >
            <UsersThree size={20} color={momentFlow.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>Tag People</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted }}>Friends, creators or brands</Text>
            </View>
            <CaretRight size={18} color={momentFlow.muted} />
          </Pressable>

          <Pressable
            onPress={() => {
              /* lightweight location prompt via text for now */
              const next = context.location ? "" : "Lagos, Nigeria";
              onContextChange({ ...context, location: next || undefined });
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
              borderRadius: 16,
              backgroundColor: momentFlow.card,
              borderWidth: 1,
              borderColor: momentFlow.accentSoft,
            }}
          >
            <MapPin size={20} color={momentFlow.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>Add Location</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted }}>
                {context.location || "City or place"}
              </Text>
            </View>
            <CaretRight size={18} color={momentFlow.muted} />
          </Pressable>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 8, backgroundColor: momentFlow.bg }}>
        <Pressable
          onPress={() => {
            hapticSelect();
            onNext();
          }}
          style={{
            paddingVertical: 16,
            borderRadius: momentFlow.radiusPill,
            backgroundColor: momentFlow.accent,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Continue to Preview</Text>
          <Text style={{ color: "#FFF8F4", fontSize: 18 }}>→</Text>
        </Pressable>
      </SafeAreaView>

      <OptionPicker
        open={picker === "skin"}
        title="Skin Type"
        options={[...SKIN_TYPES]}
        selected={context.skinType}
        onClose={() => setPicker(null)}
        onPick={(skinType) => {
          onContextChange({ ...context, skinType });
          setPicker(null);
        }}
      />
      <OptionPicker
        open={picker === "usage"}
        title="Usage"
        options={[...USAGE_FREQUENCY]}
        selected={context.usageFrequency}
        onClose={() => setPicker(null)}
        onPick={(usageFrequency) => {
          onContextChange({ ...context, usageFrequency });
          setPicker(null);
        }}
      />
      <OptionPicker
        open={picker === "duration"}
        title="Duration"
        options={[...USAGE_DURATION]}
        selected={context.usageDuration}
        onClose={() => setPicker(null)}
        onPick={(usageDuration) => {
          onContextChange({ ...context, usageDuration });
          setPicker(null);
        }}
      />

      <Modal visible={picker === "title"} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 }} onPress={() => setPicker(null)}>
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{ backgroundColor: "#FFF", borderRadius: 20, padding: 18, gap: 12 }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: momentFlow.ink }}>Edit title</Text>
            <TextInput
              value={titleDraft}
              onChangeText={setTitleDraft}
              autoFocus
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: momentFlow.accentSoft,
                fontFamily: fonts.semibold,
                fontSize: 16,
                color: momentFlow.ink,
              }}
            />
            <Pressable
              onPress={() => {
                onContextChange({ ...context, momentTitle: titleDraft.trim() || defaultMomentTitle(kind, productStory) });
                setPicker(null);
              }}
              style={{ paddingVertical: 14, borderRadius: 999, backgroundColor: momentFlow.accent, alignItems: "center" }}
            >
              <Text style={{ fontFamily: fonts.semibold, color: "#FFF8F4" }}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ContextSelect({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 16,
        backgroundColor: momentFlow.card,
        borderWidth: 1,
        borderColor: momentFlow.accentSoft,
        gap: 6,
      }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: momentFlow.muted }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: momentFlow.ink }} numberOfLines={2}>
          {value}
        </Text>
        <CaretDown size={14} color={momentFlow.muted} />
      </View>
    </Pressable>
  );
}

function OptionPicker({
  open,
  title,
  options,
  selected,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  options: string[];
  selected?: string;
  onClose: () => void;
  onPick: (v: string) => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{ backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "55%", gap: 8 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: momentFlow.ink, marginBottom: 8 }}>{title}</Text>
          <ScrollView>
            {options.map((o) => (
              <Pressable
                key={o}
                onPress={() => {
                  hapticSelect();
                  onPick(o);
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: selected === o ? momentFlow.pillPink : "transparent",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: selected === o ? momentFlow.accent : momentFlow.ink }}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
