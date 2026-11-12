import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { fonts } from "@/constants/theme";

import { useMovementPalette } from "./palette";
import { MovementButton, TextLink } from "./Press";

const COPY = {
  creator: {
    kicker: "CREATOR STUDIO",
    title: "This layer is not open yet.",
    line: "Creator tools stay closed while the First 90 builds the habit. The work is still here. It returns when this layer opens.",
  },
  rooms: {
    kicker: "AUDIO ROOMS",
    title: "This layer is not open yet.",
    line: "Rooms are part of what comes next. They are not open in this stretch of the movement.",
  },
  live: {
    kicker: "LIVE",
    title: "This layer is not open yet.",
    line: "Live is part of the next layer. It is not a room you can enter today.",
  },
  ultra: {
    kicker: "ULTRA UNMASK",
    title: "This layer is not open yet.",
    line: "Asking a brand, seller or expert directly comes later. For now, share your experience, build your timeline, and learn from the community.",
  },
} as const;

export function PausedLayer({ surface }: { surface: keyof typeof COPY }) {
  const palette = useMovementPalette();
  const router = useRouter();
  const copy = COPY[surface];
  const go = (href: string) => router.replace(href as Href);
  return (
    <View style={{ flex: 1, backgroundColor: palette.page, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 36 }}>
      <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 22 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: palette.wine, letterSpacing: -0.4 }}>Unmask</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 2.2, color: palette.gold }}>{copy.kicker}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 36, lineHeight: 42, letterSpacing: -0.5, color: palette.ink }}>
          {copy.title}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: palette.muted }}>{copy.line}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, color: palette.ink }}>The next layer is coming.</Text>
        <MovementButton label="Search products" onPress={() => go("/results")} />
        <MovementButton tone="quiet" label="See the community" onPress={() => go("/community")} />
        <TextLink label="Back to the First 90" color={palette.wine} onPress={() => go("/welcome")} />
      </View>
    </View>
  );
}
