import { useEffect } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Avatar } from "./Avatar";
import { Lightning } from "@/components/icons";
import { colors } from "@/constants/theme";

/** The portrait stays still; light travels around the member's identity ring. */
export function MemberAvatar({ name, uri, size = 56, claimed = false, preview = false }: {
  name?: string | null; uri?: string | null; size?: number; claimed?: boolean; preview?: boolean;
}) {
  const reduced = useReducedMotion(), turn = useSharedValue(0), glow = useSharedValue(0.35);
  const active = claimed || preview, outer = size + 16;
  useEffect(() => {
    turn.value = 0;
    if (active && !reduced) {
      turn.value = withRepeat(withTiming(360, { duration: claimed ? 7000 : 11000, easing: Easing.linear }), -1, false);
      glow.value = withRepeat(withTiming(0.7, { duration: 1800 }), -1, true);
    } else { glow.value = 0.4; }
    return () => { cancelAnimation(turn); cancelAnimation(glow); };
  }, [active, claimed, reduced, turn, glow]);
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value }));
  if (!active) return <Avatar name={name} uri={uri} size={size} />;
  return <View accessibilityLabel={claimed ? "Unmasker member ring" : "Animated preview of the Unmasker ring"}
    style={{ width: outer, height: outer, alignSelf: "flex-start", alignItems: "center", justifyContent: "center" }}>
    <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: -3, borderRadius: outer, backgroundColor: claimed ? "#E8C365" : "#CFA4B1" }, halo]} />
    <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, borderRadius: outer, overflow: "hidden" }, orbit]}>
      <LinearGradient colors={claimed ? ["#F9E7A8", "#B44B72", "#421425", "#D8AA4F", "#F9E7A8"] : ["#E4CBD4", "#7D3D58", "#F7E6B3", "#E4CBD4"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: outer, height: outer }} />
      <View style={{ position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFAE5", top: 1, left: outer / 2 - 3, boxShadow: "0 0 10px #F2D25B" }} />
      <View style={{ position: "absolute", width: 4, height: 4, borderRadius: 3, backgroundColor: "#FFFAE5", bottom: 3, left: outer / 2 }} />
    </Animated.View>
    <View style={{ padding: 4, borderRadius: outer, backgroundColor: "#fff" }}><Avatar name={name} uri={uri} size={size} /></View>
    {claimed ? <View style={{ position: "absolute", right: -2, bottom: -1, width: 23, height: 23, borderRadius: 9, borderWidth: 2, borderColor: "#fff", backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}><Lightning size={12} weight="fill" color="#F2D25B" /></View> : null}
  </View>;
}
