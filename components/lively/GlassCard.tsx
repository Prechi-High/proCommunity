import { type ReactNode } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";

import {
  glass,
  livelyElevation,
  livelyRadii,
} from "@/constants/design-language";
import { colors } from "@/constants/theme";

export function GlassCard({
  children,
  style,
  strong,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  padded?: boolean;
}) {
  const base: ViewStyle = {
    borderRadius: livelyRadii.card,
    backgroundColor: strong ? glass.fillStrong : glass.fill,
    borderWidth: 1,
    borderColor: glass.strokeMuted,
    padding: padded ? 18 : 0,
    overflow: "hidden",
    ...livelyElevation.card,
  };
  if (Platform.OS === "web") {
    (base as ViewStyle & { backdropFilter?: string }).backdropFilter =
      `blur(${glass.blurPx}px)`;
    (base as ViewStyle & { WebkitBackdropFilter?: string }).WebkitBackdropFilter =
      `blur(${glass.blurPx}px)`;
  }
  return (
    <View style={[base, style]}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: glass.stroke,
        }}
      />
      {children}
    </View>
  );
}

export function glassHairline(): ViewStyle {
  return { borderColor: colors.line, borderWidth: 1 };
}
