import { useState } from "react";
import { Pressable, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";

import { useMovementPalette } from "./palette";

export function MovementButton({
  label,
  onPress,
  tone = "primary",
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "quiet";
  accessibilityLabel?: string;
}) {
  const palette = useMovementPalette();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const primary = tone === "primary";
  return (
    <Animated.View style={motion}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        onPress={() => {
          hapticSelect();
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(reduce ? 1 : 0.98, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 140 });
        }}
        style={({ pressed }) => ({
          minHeight: 52,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primary ? palette.button : pressed ? palette.line : palette.quiet,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 16,
            letterSpacing: 0.2,
            color: primary ? palette.buttonText : palette.ink,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function TextLink({
  label,
  onPress,
  color,
  style,
}: {
  label: string;
  onPress: () => void;
  color: string;
  style?: StyleProp<ViewStyle>;
} & Pick<PressableProps, "accessibilityLabel">) {
  const [focus, setFocus] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.7 : 1, alignSelf: "flex-start" }, style]}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 15,
          color,
          textDecorationLine: focus ? "underline" : "none",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
