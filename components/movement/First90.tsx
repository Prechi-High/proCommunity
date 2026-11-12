import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { fonts } from "@/constants/theme";
import { first90, type First90State } from "@/lib/movement/first90";

import { useMovementPalette } from "./palette";
import { MovementButton } from "./Press";

const WITH_US = "unmask.first90.withUs";

function useWithUs() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(WITH_US)
      .then((value) => {
        if (alive) setOn(value === "1");
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return {
    on,
    join: () => {
      setOn(true);
      void AsyncStorage.setItem(WITH_US, "1").catch(() => undefined);
    },
  };
}

function DayMark({ state }: { state: First90State }) {
  const palette = useMovementPalette();
  const label =
    state.status === "before" ? "Soon" : String(state.day).padStart(2, "0");
  return (
    <View style={{ gap: 4 }}>
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 12,
          letterSpacing: 2.4,
          color: palette.gold,
        }}
      >
        {state.status === "complete" ? "THE FIRST 90" : "DAY"}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.displayBold,
          fontSize: state.status === "before" ? 48 : 64,
          lineHeight: state.status === "before" ? 54 : 68,
          letterSpacing: -1.2,
          color: palette.ink,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, letterSpacing: 1.6, color: palette.muted }}>
        {state.status === "before" ? `BEGINS ${state.start}` : `/  ${90}`}
      </Text>
    </View>
  );
}

export function First90({ now = new Date() }: { now?: Date }) {
  const palette = useMovementPalette();
  const state = first90(now);
  const reduce = useReducedMotion();
  const glow = useSharedValue(0.72);
  const withUs = useWithUs();
  const [width, setWidth] = useState(0);
  const stacked = width < 640;
  useEffect(() => {
    if (reduce) return;
    glow.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
  }, [glow, reduce]);
  const rule = useAnimatedStyle(() => ({ opacity: reduce ? 1 : glow.value }));
  const spoken =
    state.status === "before"
      ? `The First 90 begins ${state.start}. ${state.line}`
      : state.status === "complete"
        ? `Day 90 of 90. ${state.line}`
        : `Day ${state.day} of 90. ${state.phase}. ${state.line}`;
  return (
    <View
      accessibilityLabel={spoken}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        backgroundColor: palette.card,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: palette.line,
        padding: 28,
        gap: 22,
      }}
    >
      <View style={{ flexDirection: stacked ? "column" : "row", justifyContent: "space-between", alignItems: stacked ? "flex-start" : "flex-end", gap: 16 }}>
        <DayMark state={state} />
        <View style={{ alignItems: stacked ? "flex-start" : "flex-end", gap: 8, flex: stacked ? undefined : 1 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 2.2, color: palette.gold }}>
            THE FIRST 90
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, color: palette.ink, textAlign: stacked ? "left" : "right" }}>
            {state.phase}
          </Text>
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 90, now: state.status === "before" ? 0 : state.day }}
        style={{ height: 2, borderRadius: 2, backgroundColor: palette.line, overflow: "hidden" }}
      >
        <Animated.View
          style={[
            { height: 2, width: `${Math.round(state.progress * 100)}%`, backgroundColor: palette.goldLine, borderRadius: 2 },
            rule,
          ]}
        />
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: palette.ink }}>{state.line}</Text>
      {state.status === "complete" ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: palette.muted }}>
          {withUs.on ? "You counted with us." : "Day 90 is not the beginning."}
        </Text>
      ) : (
        <MovementButton
          tone={withUs.on ? "quiet" : "primary"}
          label={withUs.on ? "You are counting with us" : "Countdown with us"}
          onPress={withUs.join}
        />
      )}
    </View>
  );
}
