import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import { Check } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSuccess } from "@/lib/haptics";

/** A single acknowledgement after a successful save; respects reduced motion. */
export function JournalSaved() {
  const reduce = useReducedMotion();
  useEffect(() => {
    hapticSuccess();
  }, []);
  return (
    <Animated.View
      entering={reduce ? undefined : FadeIn.duration(260)}
      accessibilityRole="alert"
      style={{
        padding: 26,
        borderRadius: 26,
        backgroundColor: "#EDF6EF",
        alignItems: "center",
        gap: 12,
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 18,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "space-around",
        }}
      >
        {["#E8C875", "#8FC5AB", "#D4ADBF", "#E8C875"].map((color, i) => (
          <Animated.View
            key={i}
            entering={
              reduce ? undefined : ZoomIn.delay(100 + i * 90).springify()
            }
            style={{
              width: 9,
              height: 15,
              borderRadius: 3,
              backgroundColor: color,
              transform: [{ rotate: `${i * 35 - 40}deg` }],
            }}
          />
        ))}
      </View>
      <Animated.View
        entering={reduce ? undefined : ZoomIn.springify().damping(12)}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "#245B4C",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={32} color="#fff" weight="bold" />
      </Animated.View>
      <Text
        style={{ fontFamily: fonts.semibold, fontSize: 24, color: colors.ink }}
      >
        A chapter worth keeping.
      </Text>
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 15,
          lineHeight: 22,
          color: colors.inkSoft,
          textAlign: "center",
        }}
      >
        Saved to your journal. Come back whenever you have something new to add.
      </Text>
    </Animated.View>
  );
}
