import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { fonts } from "@/constants/theme";
import { first90 } from "@/lib/movement/first90";
import { useAppStore } from "@/lib/store";

import { LivingFeed } from "./LivingFeed";

export function SocialHome() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const name = (profile?.displayName || "You").split(" ")[0];
  const movement = first90();
  const day =
    movement.status === "during" ? `Day ${movement.day} of 90` : movement.phase || "Unmask";

  return (
    <View style={{ gap: 8, paddingBottom: 8 }}>
      <View style={{ paddingHorizontal: 16, gap: 4 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.6, color: "#F0CF69" }}>{day.toUpperCase()}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: "#FFF8F4" }}>
          {name}, the room is already moving.
        </Text>
        <Text
          onPress={() => router.push("/results" as Href)}
          style={{ fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,248,244,0.7)" }}
        >
          Search a product →
        </Text>
      </View>
      <LivingFeed />
    </View>
  );
}
