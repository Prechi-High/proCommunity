import { useEffect, useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, DotsThree, Handbag, Package, Plus, X } from "@/components/icons";
import { AddProductSheet } from "@/components/moment/AddProductSheet";
import { momentFlow } from "@/lib/moment/flowTheme";
import { routineIconFor } from "@/lib/moment/routineIcons";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { GRWM_OCCASION_TILES } from "@/lib/moment/grwmOccasions";
import { USAGE_DURATION, momentConfig, type MomentKind } from "@/lib/moment/kinds";
import type { MomentAttachedProduct, MomentContext } from "@/lib/moment/types";
import { useRoomTone } from "@/lib/social/roomTone";
import { useAppStore } from "@/lib/store";

export type { MomentContext };

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=200&q=80`;
const EXAMPLES = [
  { id: "sample-tl-dew", name: "Dew Days Daily Cream", when: "Week 2", image: img("photo-1556228720-195a672e8a03") },
  { id: "sample-tl-spf", name: "Sunroom Daily SPF", when: "Daily", image: img("photo-1570172619644-dfd03ed5d881") },
];

export function MomentComplete({
  kind,
  mediaUri,
  mediaKind,
  onBack,
  onNext,
  context,
  onContextChange,
  productSheetOpen,
  onProductSheetOpenChange,
  onAttachProduct,
  onDiscard,
}: {
  kind: MomentKind;
  mediaUri: string;
  mediaKind: "photo" | "video";
  onBack: () => void;
  onNext: (ctx: MomentContext) => void;
  context: MomentContext;
  onContextChange: (ctx: MomentContext) => void;
  productSheetOpen: boolean;
  onProductSheetOpenChange: (open: boolean) => void;
  onAttachProduct: (p: MomentAttachedProduct) => void;
  onDiscard?: () => void;
}) {
  const config = momentConfig(kind);
  const tone = useRoomTone();
  const uid = useAppStore((s) => s.profile?.id);
  const journeys = useQuery({ queryKey: ["living", "journeys", uid, "moment"], queryFn: living.journeys, enabled: !!uid });
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [customOccasionOpen, setCustomOccasionOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState(context.customOccasion ?? "");
  const ctx = context;
  const setCtx = (updater: MomentContext | ((c: MomentContext) => MomentContext)) => {
    const next = typeof updater === "function" ? updater(ctx) : updater;
    onContextChange(next);
  };
  useEffect(() => {
    if (kind === "grwm" && !context.occasion) {
      onContextChange({ ...context, occasion: "Date Night" });
    }
    // only seed default occasion on entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  const cream = kind === "morning" || kind === "currently";
  const bg = cream ? "#F9F5EB" : kind === "evening" ? "#140B12" : "#FFF8F4";
  const ink = kind === "evening" ? "#FFF8F4" : "#2D1B1B";

  const real = (journeys.data ?? []).map((row) => ({
    id: row.id,
    name: row.unmask_catalog?.name || "Your product",
    when: row.frequency || row.status || "Timeline",
    image: row.unmask_catalog?.image_url || null,
  }));
  const choices = real.length ? real : EXAMPLES;

  const selectProduct = (id: string, name: string, when: string, image?: string | null) => {
    setCtx((c) => ({
      ...c,
      timelineId: id,
      productName: name,
      productImage: image || undefined,
      timelineLabel: `${name} · ${when}`,
    }));
    setPicker(false);
  };

  const toggleRoutine = (tag: string) => {
    hapticSelect();
    setCtx((c) => {
      const list = c.routineTags ?? [];
      const routineTags = list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
      return { ...c, routineTags };
    });
  };

  const iconChip = (label: string, active: boolean, onPress: () => void) => {
    const Icon = routineIconFor(label);
    return (
      <Pressable
        key={label}
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: active ? (kind === "evening" ? "#8E4052" : "#70323E") : kind === "evening" ? "rgba(255,255,255,0.1)" : "#F2D8D8",
        }}
      >
        <Icon size={16} color={active ? "#FFF8F4" : ink} weight={active ? "fill" : "regular"} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: active ? "#FFF8F4" : ink }}>{label}</Text>
      </Pressable>
    );
  };

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? (kind === "evening" ? "#8E4052" : "#70323E") : kind === "evening" ? "rgba(255,255,255,0.1)" : "#F2D8D8",
      }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: active ? "#FFF8F4" : ink }}>{label}</Text>
    </Pressable>
  );

  const attachProduct = (p: MomentAttachedProduct) => {
    onAttachProduct(p);
  };

  const removeProduct = (productId: string) => {
    setCtx((c) => {
      const products = (c.products ?? []).filter((p) => p.productId !== productId);
      const primary = products[0];
      return {
        ...c,
        products,
        productName: primary?.name,
        productImage: primary?.image,
        timelineId: primary?.journeyId,
      };
    });
  };

  const flowBg = kind === "grwm" ? momentFlow.bg : bg;
  const flowInk = kind === "grwm" ? momentFlow.ink : ink;

  return (
    <View style={{ flex: 1, backgroundColor: flowBg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, justifyContent: "center" }}>
            <ArrowLeft size={22} color={flowInk} />
          </Pressable>
          {kind === "grwm" ? (
            <View style={{ flex: 1, alignItems: "center" }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: momentFlow.accent }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>GRWM 💋</Text>
              </View>
            </View>
          ) : (
            <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.serifBold, fontSize: 18, color: flowInk }}>{config.completeTitle}</Text>
          )}
          <Pressable onPress={() => setMenu(true)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <DotsThree size={24} color={flowInk} weight="bold" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
          {kind !== "grwm" ? (
            <View style={{ borderRadius: livelyRadii.hero, overflow: "hidden", height: 200 }}>
              <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
            </View>
          ) : null}

          {kind === "morning" ? (
            <View style={{ gap: 12 }}>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink }}>What are you using this morning?</Text>
                <Pressable onPress={() => setPicker(true)} style={{ marginTop: 10 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#9A7B4F" }}>→ {ctx.productName || "Add products"}</Text>
                </Pressable>
              </Card>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink, marginBottom: 10 }}>Morning routine</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {config.stickers.map((t) => iconChip(t, (ctx.routineTags ?? []).includes(t), () => toggleRoutine(t)))}
                </View>
              </Card>
            </View>
          ) : null}

          {kind === "grwm" ? (
            <View style={{ gap: 16 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: momentFlow.ink }}>What are you getting ready for?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
                {GRWM_OCCASION_TILES.map((tile) => {
                  const on = ctx.occasion === tile.id;
                  const isCustom = "custom" in tile && tile.custom;
                  return (
                    <Pressable
                      key={tile.id}
                      onPress={() => {
                        hapticSelect();
                        if (tile.id === "My Own") {
                          setCustomDraft(ctx.customOccasion ?? "");
                          setCustomOccasionOpen(true);
                        }
                        setCtx((c) => ({ ...c, occasion: tile.id }));
                      }}
                      style={{
                        width: "30.5%",
                        aspectRatio: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 6,
                        borderRadius: 16,
                        backgroundColor: on ? momentFlow.accent : momentFlow.card,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        borderWidth: isCustom ? 1.5 : on ? 0 : 1,
                        borderStyle: isCustom ? "dashed" : "solid",
                        borderColor: isCustom || !on ? momentFlow.accentSoft : "transparent",
                      }}
                    >
                      <tile.Icon size={28} color={on ? "#FFF8F4" : momentFlow.ink} weight={on ? "fill" : "bold"} />
                      {tile.lines.map((line) => (
                        <Text
                          key={line}
                          style={{
                            fontFamily: fonts.semibold,
                            fontSize: 11,
                            lineHeight: 14,
                            color: on ? "#FFF8F4" : momentFlow.ink,
                            textAlign: "center",
                          }}
                        >
                          {line}
                        </Text>
                      ))}
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: momentFlow.ink }}>Your GRWM</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  <View style={{ width: 88, height: 120, borderRadius: 14, overflow: "hidden" }}>
                    <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
                    {mediaKind === "video" ? (
                      <View style={{ position: "absolute", bottom: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.55)" }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF8F4" }}>0:28</Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => hapticSelect()}
                      style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
                    >
                      <X size={12} color="#FFF" weight="bold" />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => onProductSheetOpenChange(true)}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: momentFlow.accentSoft,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Handbag size={22} color={momentFlow.accent} />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.accent }}>Add Product</Text>
                  </Pressable>
                  {(ctx.products ?? []).map((p) => (
                      <View key={p.productId} style={{ width: 72, alignItems: "center" }}>
                        <View style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden" }}>
                          {p.image ? (
                            <Image source={{ uri: p.image }} style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
                          ) : (
                            <View style={{ flex: 1, backgroundColor: momentFlow.pillPink, alignItems: "center", justifyContent: "center" }}>
                              <Package size={20} color={momentFlow.accent} />
                            </View>
                          )}
                          <Pressable
                            onPress={() => removeProduct(p.productId)}
                            style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
                          >
                            <X size={12} color="#FFF" weight="bold" />
                          </Pressable>
                        </View>
                        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 10, color: momentFlow.muted, marginTop: 4, textAlign: "center" }}>
                          {p.name}
                        </Text>
                      </View>
                    ))}
                </ScrollView>
              </View>
            </View>
          ) : null}

          {kind === "evening" ? (
            <View style={{ gap: 12 }}>
              <Card ink={ink} evening>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink }}>What are you using tonight?</Text>
                <Pressable onPress={() => setPicker(true)} style={{ marginTop: 10 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#F0CF69" }}>→ Add product</Text>
                </Pressable>
              </Card>
              <Card ink={ink} evening>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink, marginBottom: 10 }}>Tonight&apos;s routine</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {config.stickers.map((t) => iconChip(t, (ctx.routineTags ?? []).includes(t), () => toggleRoutine(t)))}
                </View>
              </Card>
              <Card ink={ink} evening>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: ink, marginBottom: 8 }}>Add your routine</Text>
                <TextInput
                  value={ctx.eveningSteps ?? ""}
                  onChangeText={(eveningSteps) => setCtx((c) => ({ ...c, eveningSteps }))}
                  placeholder="Cleanser → Serum → Moisturizer"
                  placeholderTextColor="rgba(255,248,244,0.45)"
                  style={{ fontFamily: fonts.regular, fontSize: 14, color: ink, paddingVertical: 8 }}
                />
              </Card>
            </View>
          ) : null}

          {kind === "currently" ? (
            <View style={{ gap: 12 }}>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink }}>What are you currently using?</Text>
                <Pressable onPress={() => setPicker(true)} style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F2D8D8", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={18} color="#70323E" weight="bold" />
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#70323E" }}>{ctx.productName || "Add product"}</Text>
                </Pressable>
              </Card>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink, marginBottom: 10 }}>How long have you been using it?</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {USAGE_DURATION.map((d) => chip(d, ctx.usageDuration === d, () => setCtx((c) => ({ ...c, usageDuration: d }))))}
                </View>
              </Card>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink, marginBottom: 8 }}>Add your experience</Text>
                <TextInput
                  value={ctx.experience ?? ""}
                  onChangeText={(experience) => setCtx((c) => ({ ...c, experience }))}
                  placeholder="Tell people what you've noticed so far…"
                  placeholderTextColor="#9A7B4F"
                  multiline
                  style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: ink, minHeight: 72 }}
                />
              </Card>
            </View>
          ) : null}

        </ScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={() => onNext(ctx)}
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
            paddingVertical: 16,
            borderRadius: momentFlow.radiusPill,
            backgroundColor: kind === "grwm" ? momentFlow.accent : undefined,
            overflow: "hidden",
          }}
        >
          {kind === "grwm" ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4", textAlign: "center" }}>Continue →</Text>
          ) : (
            <LinearGradient colors={["#FF6B9D", "#70323E"]} style={{ paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Preview your Unmask ✨</Text>
            </LinearGradient>
          )}
        </Pressable>
      </SafeAreaView>

      <AddProductSheet open={productSheetOpen} onClose={() => onProductSheetOpenChange(false)} attached={ctx.products ?? []} onAttach={attachProduct} />

      <ActionSheet open={menu} title="GRWM" onClose={() => setMenu(false)}>
        <Pressable
          onPress={() => {
            setMenu(false);
            onDiscard?.();
          }}
          style={{ paddingVertical: 14 }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#B42318" }}>Discard draft</Text>
        </Pressable>
      </ActionSheet>

      <ActionSheet open={customOccasionOpen} title="My own occasion" onClose={() => setCustomOccasionOpen(false)}>
        <TextInput
          value={customDraft}
          onChangeText={setCustomDraft}
          placeholder="What's the vibe?"
          placeholderTextColor={momentFlow.muted}
          style={{ fontFamily: fonts.regular, fontSize: 16, color: momentFlow.ink, paddingVertical: 10, marginBottom: 12 }}
        />
        <Pressable
          onPress={() => {
            setCtx((c) => ({ ...c, occasion: "My Own", customOccasion: customDraft.trim() }));
            setCustomOccasionOpen(false);
          }}
          style={{ paddingVertical: 14, borderRadius: momentFlow.radiusPill, backgroundColor: momentFlow.accent, alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Save</Text>
        </Pressable>
      </ActionSheet>

      <ActionSheet open={picker} title="Add product" onClose={() => setPicker(false)}>
        {choices.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => selectProduct(row.id, row.name, row.when, row.image)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tone.line }}
          >
            {row.image ? (
              <Image source={{ uri: row.image }} style={{ width: 44, height: 44, borderRadius: 12 }} accessibilityIgnoresInvertColors />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tone.line, alignItems: "center", justifyContent: "center" }}>
                <Package size={22} color={tone.muted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: tone.text }}>{row.name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: tone.muted }}>{row.when}</Text>
            </View>
          </Pressable>
        ))}
      </ActionSheet>
    </View>
  );
}

function Card({ children, ink, evening }: { children: ReactNode; ink: string; evening?: boolean }) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 20,
        backgroundColor: evening ? "rgba(255,255,255,0.08)" : "#FFFDF8",
        borderWidth: 1,
        borderColor: evening ? "rgba(255,255,255,0.12)" : "#F2D8D8",
      }}
    >
      {children}
    </View>
  );
}