import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { fonts } from "@/constants/theme";
import { first90 } from "@/lib/movement/first90";
import { useRoomTone } from "@/lib/social/roomTone";

import { LivingFeed } from "./LivingFeed";

export function SocialHome() {
  const router = useRouter();
  const tone = useRoomTone();
  const movement = first90();
  const day =
    movement.status === "during" ? `Day ${movement.day} of 90` : movement.phase || "Unmask";

  return (
    <View style={{ gap: 6, paddingBottom: 8 }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.4, color: tone.gold }}>{day.toUpperCase()}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push("/results" as Href)}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: tone.muted }}>Search products</Text>
        </Pressable>
      </View>
      <LivingFeed />
    </View>
  );
}
