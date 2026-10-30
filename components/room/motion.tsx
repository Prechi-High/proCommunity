import { useEffect, useMemo, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";

export function PressScale({
  label,
  onPress,
  disabled,
  children,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(reduced ? 1 : 0.9, { damping: 14, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={style}
    >
      <Animated.View style={motion}>{children}</Animated.View>
    </Pressable>
  );
}

export function FloatEmoji({ glyph }: { glyph: string }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    y.value = withTiming(reduced ? -12 : -160, { duration: reduced ? 0 : 1300, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: reduced ? 0 : 1300 });
  }, [opacity, reduced, y]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.Text pointerEvents="none" style={[{ fontSize: 28 }, style]}>
      {glyph}
    </Animated.Text>
  );
}

export function PartialSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          y.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > 72) runOnJS(onClose)();
          else y.value = withSpring(0, { damping: 16, stiffness: 220 });
        }),
    [onClose, y],
  );
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      entering={reduced ? undefined : SlideInDown.springify().damping(18).stiffness(180)}
      exiting={reduced ? undefined : SlideOutDown.duration(220)}
      style={[{ width: "100%", maxWidth: 430 }, style]}
    >
      <GestureDetector gesture={pan}>
        <View accessibilityRole="adjustable" accessibilityLabel="Drag down to close" style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}

export function Tick({ value, color }: { value: number; color: string }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = reduced ? 1 : withSequence(withSpring(1.18, { damping: 12, stiffness: 280 }), withSpring(1, { damping: 14, stiffness: 220 }));
  }, [reduced, scale, value]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.Text style={[{ fontFamily: fonts.bold, fontSize: 16, color }, style]}>
      {value}
    </Animated.Text>
  );
}

export function RisingBar({ ratio }: { ratio: number }) {
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, ratio)) * 100, { duration: reduced ? 0 : 420 });
  }, [ratio, reduced, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: colors.brand }, style]} />
    </View>
  );
}
