import { useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, Plus } from "@/components/icons";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { GRWM_OCCASIONS, USAGE_DURATION, momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { useRoomTone } from "@/lib/social/roomTone";
import { useAppStore } from "@/lib/store";

export type MomentContext = {
  productName?: string;
  timelineId?: string;
  timelineLabel?: string;
  routineTag?: string;
  occasion?: string;
  usageDuration?: string;
  showRoutine?: "yes" | "skip";
  eveningSteps?: string;
  experience?: string;
};

const EXAMPLES = [
  { id: "sample-tl-dew", name: "Dew Days Daily Cream", when: "Week 2" },
  { id: "sample-tl-spf", name: "Sunroom Daily SPF", when: "Daily" },
];

export function MomentComplete({
  kind,
  mediaUri,
  mediaKind,
  onBack,
  onNext,
}: {
  kind: MomentKind;
  mediaUri: string;
  mediaKind: "photo" | "video";
  onBack: () => void;
  onNext: (ctx: MomentContext) => void;
}) {
  const config = momentConfig(kind);
  const tone = useRoomTone();
  const uid = useAppStore((s) => s.profile?.id);
  const journeys = useQuery({ queryKey: ["living", "journeys", uid, "moment"], queryFn: living.journeys, enabled: !!uid });
  const [picker, setPicker] = useState(false);
  const [ctx, setCtx] = useState<MomentContext>({});
  const cream = kind === "morning" || kind === "currently";
  const bg = cream ? "#F9F5EB" : kind === "evening" ? "#140B12" : "#FFF8F4";
  const ink = kind === "evening" ? "#FFF8F4" : "#2D1B1B";

  const real = (journeys.data ?? []).map((row) => ({
    id: row.id,
    name: row.unmask_catalog?.name || "Your product",
    when: row.frequency || row.status || "Timeline",
  }));
  const choices = real.length ? real : EXAMPLES;

  const selectProduct = (id: string, name: string, when: string) => {
    setCtx((c) => ({ ...c, timelineId: id, productName: name, timelineLabel: `${name} · ${when}` }));
    setPicker(false);
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

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, justifyContent: "center" }}>
            <ArrowLeft size={22} color={ink} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.serifBold, fontSize: 18, color: ink }}>{config.completeTitle}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
          <View style={{ borderRadius: livelyRadii.hero, overflow: "hidden", height: 200 }}>
            <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
          </View>

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
                  {config.stickers.map((t) => chip(t, ctx.routineTag === t, () => setCtx((c) => ({ ...c, routineTag: t }))))}
                </View>
              </Card>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink, marginBottom: 8 }}>Want to show your routine?</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {chip("Yes", ctx.showRoutine === "yes", () => setCtx((c) => ({ ...c, showRoutine: "yes" })))}
                  {chip("Not now", ctx.showRoutine === "skip", () => setCtx((c) => ({ ...c, showRoutine: "skip" })))}
                </View>
              </Card>
            </View>
          ) : null}

          {kind === "grwm" ? (
            <View style={{ gap: 12 }}>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink }}>What did you use?</Text>
                <Pressable onPress={() => setPicker(true)} style={{ marginTop: 10 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#70323E" }}>→ Add product</Text>
                </Pressable>
              </Card>
              <Card ink={ink}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: ink, marginBottom: 10 }}>What are you getting ready for?</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {GRWM_OCCASIONS.map((o) => chip(o, ctx.occasion === o, () => setCtx((c) => ({ ...c, occasion: o }))))}
                </View>
              </Card>
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
                  {config.stickers.map((t) => chip(t, ctx.routineTag === t, () => setCtx((c) => ({ ...c, routineTag: t }))))}
                </View>
              </Card>
              <Card ink={ink} evening>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: ink, marginBottom: 8 }}>Add your routine?</Text>
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

          <Pressable
            accessibilityRole="button"
            onPress={() => onNext(ctx)}
            style={{ borderRadius: 999, overflow: "hidden", marginTop: 8 }}
          >
            <LinearGradient colors={["#FF6B9D", "#70323E"]} style={{ paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Preview your Unmask ✨</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <ActionSheet open={picker} title="Add product" onClose={() => setPicker(false)}>
        {choices.map((row) => (
          <Pressable key={row.id} onPress={() => selectProduct(row.id, row.name, row.when)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tone.line }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: tone.text }}>{row.name}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: tone.muted }}>{row.when}</Text>
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