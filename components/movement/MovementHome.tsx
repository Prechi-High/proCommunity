import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientCanvas } from "@/components/lively";
import { LivingFeed } from "@/components/social/LivingFeed";
import { fonts } from "@/constants/theme";

export function MovementHome() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#120810" }} edges={["top"]}>
      <AmbientCanvas variant="socialNight">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: "#FFF8F4" }}>Unmask</Text>
            <Pressable onPress={() => router.push("/sign-up" as Href)}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#F0CF69" }}>Join</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, color: "#FFF8F4" }}>
              Show yourself. Show what you use. Show what happened.
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,248,244,0.7)" }}>
              Post like a story. A timeline is a plus, not a form you have to survive first.
            </Text>
          </View>
          <LivingFeed guest />
        </ScrollView>
      </AmbientCanvas>
    </SafeAreaView>
  );
}
