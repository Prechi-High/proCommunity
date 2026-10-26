import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import type { ComponentType } from "react";
import type { IconProps } from "phosphor-react-native";
import { colors, fonts } from "@/constants/theme";
export function ReactionButton({
  Icon,
  label,
  count,
  active,
  color = colors.brand,
  onPress,
  pulse = 0,
  disabled = false,
}: {
  Icon: ComponentType<IconProps>;
  label: string;
  count?: number | string;
  active?: boolean;
  color?: string;
  onPress: () => void;
  pulse?: number;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!pulse) return;
    scale.value = reduced
      ? 1
      : withSequence(withSpring(1.3, { damping: 9 }), withSpring(1));
    glow.value = 0;
    glow.value = withTiming(1, { duration: reduced ? 0 : 650 });
  }, [pulse, reduced, scale, glow]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : (1 - glow.value) * 0.5,
    transform: [{ scale: 0.6 + glow.value * 1.4 }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = reduced ? 1 : withTiming(0.86, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 44,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        borderRadius: 16,
        backgroundColor: pressed ? "#F4E9E9" : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <View
        style={{
          width: 26,
          height: 28,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {pulse > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: 30,
                height: 30,
                borderRadius: 15,
                borderWidth: 2,
                borderColor: color,
              },
              halo,
            ]}
          />
        ) : null}
        <Animated.View style={iconStyle}>
          <Icon
            size={24}
            color={active ? color : colors.ink}
            weight={active ? "fill" : "regular"}
          />
        </Animated.View>
      </View>
      {count !== undefined ? (
        <Text
          style={{
            fontFamily: active ? fonts.semibold : fonts.medium,
            fontSize: 13,
            color: active ? color : colors.inkSoft,
          }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
