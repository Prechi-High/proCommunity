import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";
export function Skeleton({
  height = 16,
  width = "100%",
  radius = 8,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
}) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = reduce
      ? 1
      : withRepeat(withTiming(0.42, { duration: 850 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduce, pulse]);
  const motion = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      accessible={false}
      style={[
        { height, width, borderRadius: radius, backgroundColor: colors.mist },
        motion,
      ]}
    />
  );
}
export function ContentSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
      style={{ gap: 14, paddingVertical: 12 }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
        >
          <Skeleton width={56} height={56} radius={16} />
          <View style={{ flex: 1, gap: 9 }}>
            <Skeleton width="82%" height={17} />
            <Skeleton width="57%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}
export function StorySkeleton() {
  return (
    <View
      accessibilityLabel="Loading story"
      accessibilityRole="progressbar"
      style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}
    >
      <Skeleton height={180} radius={22} />
      <Skeleton height={22} width="88%" />
      <Skeleton height={14} width="42%" />
    </View>
  );
}
