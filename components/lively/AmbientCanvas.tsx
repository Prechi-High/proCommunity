import { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import {
  livelyGradients,
  type LivelyGradientKey,
} from "@/constants/design-language";

export function AmbientCanvas({
  variant = "page",
  children,
  style,
}: {
  variant?: LivelyGradientKey;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const colors = livelyGradients[variant] as unknown as readonly [string, string, ...string[]];
  return (
    <View style={[{ flex: 1 }, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -40,
          right: -30,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: "rgba(201, 162, 39, 0.14)",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 180,
          left: -50,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: "rgba(35, 96, 68, 0.1)",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 120,
          right: 20,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(112, 50, 62, 0.08)",
        }}
      />
      <View style={{ flex: 1, zIndex: 1 }}>{children}</View>
    </View>
  );
}
