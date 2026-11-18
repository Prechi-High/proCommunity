import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft, CaretRight, DotsThree, Plus } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import { youVision } from "@/lib/vision/youTheme";

type ShelfTab = "active" | "past" | "saved";

function journeyDayLabel(startedOn: string | null): string | null {
  if (!startedOn) return null;
  const start = new Date(startedOn);
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
  return `Day ${days}`;
}

export default function MyProductsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const favorites = useAppStore((s) => s.favorites);
  const [tab, setTab] = useState<ShelfTab>("active");

  const journeys = useQuery({
    queryKey: ["living", "journeys", uid, "you-products"],
    queryFn: living.journeys,
    enabled: !!uid,
  });

  const active = (journeys.data ?? []).filter((j) => j.status === "active" || j.status === "purchased");
  const past = (journeys.data ?? []).filter((j) => j.status !== "active" && j.status !== "purchased");
  const rows =
    tab === "active" ? active : tab === "past" ? past : [];

  return (
    <View style={{ flex: 1, backgroundColor: youVision.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}>
          <ArrowLeft size={22} color={youVision.ink} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: youVision.ink }}>My Products</Text>
        <Pressable style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <DotsThree size={24} color={youVision.ink} weight="bold" />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
        {(
          [
            ["active", `Active (${active.length})`],
            ["past", `Past (${past.length})`],
            ["saved", `Saved (${favorites.length})`],
          ] as const
        ).map(([id, label]) => {
          const on = tab === id;
          return (
            <Pressable key={id} onPress={() => setTab(id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: youVision.radiusPill, backgroundColor: on ? youVision.maroon : youVision.card, borderWidth: on ? 0 : 1, borderColor: youVision.pinkGrad }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? "#FFF" : youVision.ink }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 90 }}>
        {tab === "saved" ? (
          <Pressable onPress={() => router.push("/saved-items" as Href)} style={{ padding: 16, borderRadius: youVision.radiusCard, backgroundColor: youVision.card }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: youVision.ink }}>Open saved items</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: youVision.muted, marginTop: 4 }}>{favorites.length} saved</Text>
          </Pressable>
        ) : (
          rows.map((j) => {
            const name = j.unmask_catalog?.name || "Your product";
            const image = j.unmask_catalog?.image_url;
            return (
              <Pressable
                key={j.id}
                onPress={() => {
                  hapticSelect();
                  router.push(`/journey/${j.id}` as Href);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: youVision.radiusCard, backgroundColor: youVision.card }}
              >
                {image ? (
                  <Image source={{ uri: image }} style={{ width: 52, height: 52, borderRadius: 12 }} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: youVision.pinkSoft }} />
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: youVision.ink }}>{name}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: youVision.muted }}>
                    {[journeyDayLabel(j.started_on), j.status === "active" || j.status === "purchased" ? "Active" : "Past"].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <CaretRight size={18} color={youVision.muted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/products/add" as Href)}
        style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 80, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: youVision.radiusPill, backgroundColor: youVision.maroon }}
      >
        <Plus size={20} color="#FFF" weight="bold" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#FFF" }}>Add a Product</Text>
      </Pressable>
    </View>
  );
}