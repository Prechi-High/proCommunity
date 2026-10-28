import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import {
  ArrowRight,
  Lightning,
  Play,
  Plus,
  Check,
  ArrowClockwise,
} from "@/components/icons";
import { colors, fonts, radii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
type Tone = "primary" | "secondary" | "ghost" | "gold";
const tones = {
  primary: { bg: colors.brandDeep, fg: colors.white },
  secondary: { bg: "#F0EAE6", fg: colors.ink },
  ghost: { bg: "transparent", fg: colors.brandDeep },
  gold: { bg: "#F2DEAA", fg: "#63440C" },
};
export function ActionButton({
  label,
  onPress,
  tone = "primary",
  pending,
  disabled,
  explanation,
  icon,
  pendingLabel = "Working…",
}: {
  label: string;
  onPress?: () => void;
  tone?: Tone;
  pending?: boolean;
  disabled?: boolean;
  explanation?: string;
  icon?: ReactNode;
  pendingLabel?: string;
}) {
  const [focus, setFocus] = useState(false);
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const t = tones[tone];
  const locked = !!(disabled || pending);
  const Icon = /spark/i.test(label)
    ? Lightning
    : /watch|play/i.test(label)
      ? Play
      : /try again|retry|refresh/i.test(label)
        ? ArrowClockwise
        : /add|track|share/i.test(label)
          ? Plus
          : /done|saved/i.test(label)
            ? Check
            : null;
  return (
    <View style={{ gap: 8 }}>
      <Animated.View style={motion}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: locked, busy: !!pending }}
          accessibilityLabel={label}
          disabled={locked}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onPressIn={() => {
            scale.value = withTiming(reduce ? 1 : 0.98, { duration: 80 });
          }}
          onPressOut={() => {
            scale.value = withTiming(1, { duration: 120 });
          }}
          onPress={() => {
            hapticSelect();
            onPress?.();
          }}
          style={({ pressed }) => ({
            minHeight: tone === "ghost" ? 44 : 48,
            paddingVertical: tone === "ghost" ? 9 : 12,
            borderRadius: 16,
            paddingHorizontal: 18,
            backgroundColor:
              pressed && !locked
                ? tone === "primary"
                  ? "#602A38"
                  : "#E8DAD2"
                : t.bg,
            borderWidth: focus || tone === "secondary" ? 1 : 0,
            borderColor: focus ? colors.brand : colors.line,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            opacity: locked ? 0.5 : 1,
          })}
        >
          {pending ? (
            <ActivityIndicator size="small" color={t.fg} />
          ) : (
            (icon ?? (Icon ? <Icon size={19} color={t.fg} /> : null))
          )}
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 15,
              lineHeight: 22,
              color: t.fg,
              flexShrink: 1,
              textAlign: "center",
            }}
          >
            {pending ? pendingLabel : label}
          </Text>
        </Pressable>
      </Animated.View>
      {locked && explanation ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 14,
            lineHeight: 20,
            color: colors.inkSoft,
          }}
        >
          {explanation}
        </Text>
      ) : null}
    </View>
  );
}
