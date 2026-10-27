import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
/** Full-height track and a 44px touch target on web and native. */
export function Toggle({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion(),
    x = useSharedValue(value ? 20 : 0);
  useEffect(() => {
    x.value = withTiming(value ? 20 : 0, { duration: reduce ? 0 : 160 });
  }, [value, reduce, x]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        hapticSelect();
        onChange(!value);
      }}
      style={{
        width: 56,
        minHeight: 44,
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 54,
          height: 34,
          borderRadius: 18,
          padding: 4,
          backgroundColor: value ? colors.brandDeep : "#D7D3CF",
          borderWidth: 1,
          borderColor: value ? colors.brandDeep : "#BEB8B2",
        }}
      >
        <Animated.View
          style={[
            {
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#fff",
              boxShadow: "0px 1px 4px rgba(0,0,0,.18)",
            },
            motion,
          ]}
        />
      </View>
    </Pressable>
  );
}
