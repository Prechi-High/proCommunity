import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientCanvas } from "@/components/lively";
import { GlassCard } from "@/components/lively";
import { ActionButton } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CINEMATIC_AT } from "@/lib/movement/frame";
import { CommunityPulse } from "@/components/social/CommunityPulse";

import { First90 } from "./First90";
import { OrientationFilm } from "./OrientationFilm";
import { useMovementPalette } from "./palette";
import { MovementButton, TextLink } from "./Press";

export function MovementHome() {
  const palette = useMovementPalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= CINEMATIC_AT;
  const [movementOpen, setMovementOpen] = useState(false);
  const go = (href: string) => router.push(href as Href);
  const started = () => go("/sign-up");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.page }} edges={["top"]}>
      <AmbientCanvas variant="social">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 88 }}>
          <View
            style={{
              paddingHorizontal: wide ? 56 : 20,
              paddingTop: 12,
              paddingBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: palette.wine, letterSpacing: -0.4 }}>Unmask</Text>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <Pressable accessibilityRole="button" onPress={() => go("/moment")}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.wine }}>Post</Text>
              </Pressable>
              <TextLink label="Sign in" color={palette.ink} onPress={() => go("/(auth)/sign-in")} />
            </View>
          </View>

          <View style={{ paddingHorizontal: wide ? 56 : 20, gap: 8, paddingBottom: 12 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.6, color: palette.gold }}>SHOW YOURSELF</Text>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.displayBold, fontSize: wide ? 44 : 34, lineHeight: wide ? 50 : 40, letterSpacing: -0.6, color: palette.ink, maxWidth: 520 }}>
              A real community — not a form.
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: palette.muted, maxWidth: 480 }}>
              Post moments like stories. Attach My Unmask or a timeline when you want. Start without either.
            </Text>
            <View style={{ flexDirection: wide ? "row" : "column", gap: 10, paddingTop: 8, maxWidth: 420 }}>
              <ActionButton label="Share your moment" onPress={() => go("/moment")} />
              <MovementButton tone="quiet" label="Join Unmask" onPress={started} />
            </View>
          </View>

          <CommunityPulse showCta={false} />

          <View style={{ paddingHorizontal: wide ? 56 : 20, paddingTop: 28, gap: 16 }}>
            <OrientationFilm />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticSelect();
              setMovementOpen((v) => !v);
            }}
            style={{ paddingHorizontal: wide ? 56 : 20, paddingTop: 24 }}
          >
            <GlassCard>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: palette.ink }}>The First 90 movement</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: palette.wine }}>{movementOpen ? "Hide" : "Show"}</Text>
              </View>
              {movementOpen ? (
                <View style={{ gap: 16, paddingTop: 16 }}>
                  <First90 />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: palette.muted }}>
                    Don’t just watch Unmask. Unmask with us.
                  </Text>
                </View>
              ) : null}
            </GlassCard>
          </Pressable>

          <View style={{ paddingHorizontal: wide ? 56 : 20, paddingTop: 24, paddingBottom: 32, gap: 12, alignItems: wide ? "flex-start" : "stretch" }}>
            <ActionButton label="Get Started" onPress={started} />
            <TextLink label="Already an Unmasker? Sign in" color={palette.wine} onPress={() => go("/(auth)/sign-in")} />
          </View>
        </ScrollView>
      </AmbientCanvas>
    </SafeAreaView>
  );
}
