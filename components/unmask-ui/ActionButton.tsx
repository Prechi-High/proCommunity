import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { Lightning, Play, Plus, Check, ArrowClockwise } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";

type Tone = "primary" | "secondary" | "ghost" | "gold";
const tones = {
  primary: { bg: colors.brandDeep, fg: "#FFFFFF" },
  secondary: { bg: "#1A2741", fg: colors.ink },
  ghost: { bg: "transparent", fg: "#B7A7FF" },
  gold: { bg: "#E9C16B", fg: "#182033" },
};
export function ActionButton({ label, onPress, tone = "primary", pending, disabled, explanation, icon, pendingLabel = "Working…" }: {
  label: string; onPress?: () => void; tone?: Tone; pending?: boolean; disabled?: boolean; explanation?: string; icon?: ReactNode; pendingLabel?: string;
}) {
  const [focus, setFocus] = useState(false);
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const t = tones[tone], locked = !!(disabled || pending);
  const Icon = /spark/i.test(label) ? Lightning : /watch|play/i.test(label) ? Play : /try again|retry|refresh/i.test(label) ? ArrowClockwise : /add|track|share/i.test(label) ? Plus : /done|saved/i.test(label) ? Check : null;
  return (
    <View style={{ gap: 8 }}>
      <Animated.View style={motion}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: locked, busy: !!pending }} accessibilityLabel={label} disabled={locked}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onPressIn={() => { scale.value = withTiming(reduce ? 1 : 0.985, { duration: 85 }); }}
          onPressOut={() => { scale.value = withTiming(1, { duration: 130 }); }}
          onPress={() => { hapticSelect(); onPress?.(); }}
          style={({ pressed }) => ({
            minHeight: 46, paddingVertical: 11, borderRadius: 12, paddingHorizontal: 17,
            backgroundColor: pressed && !locked ? (tone === "primary" ? "#6F57D9" : tone === "gold" ? "#D9B45F" : "#253450") : t.bg,
            borderWidth: tone === "primary" || tone === "gold" ? 0 : 1,
            borderColor: focus ? "#B7A7FF" : colors.line,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
            opacity: locked ? 0.48 : 1,
          })}>
          {pending ? <ActivityIndicator size="small" color={t.fg} /> : (icon ?? (Icon ? <Icon size={18} color={t.fg} /> : null))}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: t.fg, flexShrink: 1, textAlign: "center" }}>{pending ? pendingLabel : label}</Text>
        </Pressable>
      </Animated.View>
      {locked && explanation ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>{explanation}</Text> : null}
    </View>
  );
}
