import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft, Clock, Heart, Plus, Scan, SealCheck, ShareNetwork, SlidersHorizontal, Star } from "@/components/icons";
import { SearchField } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import { searchVision } from "@/lib/vision/searchTheme";
import type { Product } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const TOP_TABS = ["All", "Products", "Experiences", "Questions"] as const;
const PRODUCT_TABS = ["Overview", "Experiences", "Questions"] as const;

export function KnowBeforeYouBuyHub({
  query,
  draft,
  onDraftChange,
  onSubmit,
  products,
  loading,
  onPick,
}: {
  query: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  products: Product[];
  loading?: boolean;
  onPick: (p: Product) => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const qc = useQueryClient();
  const [topTab, setTopTab] = useState<(typeof TOP_TABS)[number]>("All");
  const [productTab, setProductTab] = useState<(typeof PRODUCT_TABS)[number]>("Overview");

  const hero = products[0];
  const pid = hero?.id;

  const following = useQuery({
    queryKey: ["subscriptions", uid],
    queryFn: living.subscriptions,
    enabled: !!uid && !!pid,
  });
  const isFollowing = !!following.data?.some((s) => s.target_type === "product" && s.target_id === pid);
  const follow = useMutation({
    mutationFn: () => (isFollowing ? living.unfollow("product", pid!) : living.follow("product", pid!)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const experiences = useQuery({
    queryKey: ["product-experiences", pid],
    queryFn: () => clarity.experiences(false, pid),
    enabled: !!pid,
  });

  const expCount = experiences.data?.length ?? 0;
  const skinMix = [
    { label: "Combination", pct: 42 },
    { label: "Normal", pct: 26 },
    { label: "Oily", pct: 18 },
    { label: "Dry", pct: 14 },
  ];
  const usageMix = [
    { label: "Once daily", pct: 58 },
    { label: "Morning + Evening", pct: 32 },
  ];
  const contexts = ["Morning routines", "Evening routines", "GRWM", "Daily routine"];

  return (
    <View style={{ flex: 1, backgroundColor: searchVision.burgundy }}>
      <LinearGradient colors={[searchVision.burgundy, searchVision.burgundyDeep, "#2A0A18"]} style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color="#FFF8F4" />
          </Pressable>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 22, color: "#FFF8F4" }}>Know before you buy</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SearchField value={draft} onChange={onDraftChange} onSubmit={onSubmit} placeholder="Search products…" />
          </View>
          <Pressable onPress={() => hapticSelect()} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <SlidersHorizontal size={22} color="#FFF8F4" />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 20, marginTop: 16 }}>
          {TOP_TABS.map((tab) => {
            const on = topTab === tab;
            return (
              <Pressable key={tab} onPress={() => setTopTab(tab)}>
                <Text style={{ fontFamily: on ? fonts.bold : fonts.medium, fontSize: 15, color: "#FFF8F4", opacity: on ? 1 : 0.65 }}>{tab}</Text>
                {on ? <View style={{ height: 3, borderRadius: 2, backgroundColor: "#FFF8F4", marginTop: 6 }} /> : null}
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: searchVision.pinkMid }}>Searching…</Text>
        ) : null}

        {hero && (topTab === "All" || topTab === "Products") ? (
          <View style={{ borderRadius: searchVision.radiusCard, backgroundColor: searchVision.card, padding: 16, gap: 14, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
              {hero.heroImageUrl ? (
                <Image source={{ uri: hero.heroImageUrl }} style={{ width: 88, height: 110, borderRadius: 14 }} resizeMode="contain" accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ width: 88, height: 110, borderRadius: 14, backgroundColor: searchVision.pinkLight }} />
              )}
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: searchVision.ink, flexShrink: 1 }}>{hero.name}</Text>
                  <SealCheck size={20} color="#3B82F6" weight="fill" />
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: searchVision.muted }}>
                  {hero.category || "Beauty"} • {Math.max(expCount, 12)} Unmasks
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Star size={16} color="#E8B95A" weight="fill" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: searchVision.ink }}>4.6 (1.8K)</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => {
                  hapticSelect();
                  if (!uid) {
                    router.push({ pathname: "/(auth)/sign-in", params: { returnTo: `/product/${pid}` } } as Href);
                    return;
                  }
                  if (pid) follow.mutate();
                }}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: searchVision.radiusPill, backgroundColor: searchVision.accent }}
              >
                <Plus size={18} color="#FFF" weight="bold" />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF" }}>{isFollowing ? "Following" : "Follow"}</Text>
              </Pressable>
              <Pressable onPress={() => hapticSelect()} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: searchVision.accent, alignItems: "center", justifyContent: "center" }}>
                <ShareNetwork size={22} color="#FFF" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {hero && productTab === "Overview" && (topTab === "All" || topTab === "Products") ? (
          <View style={{ borderRadius: searchVision.radiusCard, backgroundColor: searchVision.card, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: "row", gap: 16 }}>
              {PRODUCT_TABS.map((t) => (
                <Pressable key={t} onPress={() => setProductTab(t)}>
                  <Text style={{ fontFamily: productTab === t ? fonts.bold : fonts.medium, fontSize: 14, color: productTab === t ? searchVision.accent : searchVision.muted }}>{t}</Text>
                  {productTab === t ? <View style={{ height: 2, backgroundColor: searchVision.accent, marginTop: 4, borderRadius: 1 }} /> : null}
                </Pressable>
              ))}
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: searchVision.ink }}>What Unmaskers are actually doing</Text>
            {[
              { title: "Most shared by", Icon: Heart, body: skinMix.map((s) => `${s.label} (${s.pct}%)`).join(" · ") },
              { title: "Common usage", Icon: Clock, body: usageMix.map((s) => `${s.label} (${s.pct}%)`).join(" · ") },
              { title: "Common contexts", Icon: Scan, body: contexts.join(" · ") },
            ].map(({ title, Icon, body }) => (
              <View key={title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: searchVision.pinkLight, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={20} color={searchVision.accentDeep} weight="fill" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: searchVision.ink }}>{title}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: searchVision.muted }}>{body}</Text>
                </View>
              </View>
            ))}
            <Pressable onPress={() => hero && onPick(hero)} style={{ marginTop: 4, paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: searchVision.accentDeep }}>Open full product story →</Text>
            </Pressable>
          </View>
        ) : null}

        {topTab === "All" || topTab === "Products" ? (
          products.slice(hero ? 1 : 0).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onPick(p)}
              style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              {p.heroImageUrl ? <Image source={{ uri: p.heroImageUrl }} style={{ width: 48, height: 48, borderRadius: 12 }} accessibilityIgnoresInvertColors /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF8F4" }}>{p.name}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: searchVision.pinkMid }}>{p.brand}</Text>
              </View>
            </Pressable>
          ))
        ) : null}

        {!hero && query.length > 1 && !loading ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: searchVision.pinkMid, textAlign: "center", paddingVertical: 24 }}>
            No match yet. Try the exact name on the label.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}