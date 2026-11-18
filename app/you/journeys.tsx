import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft, CaretRight, DotsThree, TrendUp } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import { youVision } from "@/lib/vision/youTheme";

export default function MyJourneysScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);

  const journeys = useQuery({
    queryKey: ["living", "journeys", uid, "you-journeys"],
    queryFn: living.journeys,
    enabled: !!uid,
  });

  const rows = journeys.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: youVision.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}>
          <ArrowLeft size={22} color={youVision.ink} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: youVision.ink }}>Journeys</Text>
        <Pressable style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <DotsThree size={24} color={youVision.ink} weight="bold" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}>
        {rows.length === 0 ? (
          <View style={{ padding: 24, borderRadius: youVision.radiusCard, backgroundColor: youVision.card, alignItems: "center", gap: 8 }}>
            <TrendUp size={32} color={youVision.maroon} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: youVision.ink, textAlign: "center" }}>No journeys yet</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: youVision.muted, textAlign: "center" }}>Add a product and track your routine to build a journey.</Text>
            <Pressable onPress={() => router.push("/you/products" as Href)} style={{ marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: youVision.radiusPill, backgroundColor: youVision.maroon }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF" }}>Go to My Products</Text>
            </Pressable>
          </View>
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
                  <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: youVision.pinkSoft, alignItems: "center", justifyContent: "center" }}>
                    <TrendUp size={22} color={youVision.maroon} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: youVision.ink }}>{name}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: youVision.muted }}>
                    {j.status === "active" || j.status === "purchased" ? "Active" : "Past"} · {j.frequency || "Routine"}
                  </Text>
                </View>
                <CaretRight size={18} color={youVision.muted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}