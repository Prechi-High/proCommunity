import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { MicrophoneSlash } from "@/components/icons";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { colors, fonts } from "@/constants/theme";
import type { RoomSeat } from "@/lib/room/types";
import { initials } from "@/lib/unmask/time";

function Ring({
  size,
  speaking,
  delay,
}: {
  size: number;
  speaking: boolean;
  delay: number;
}) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (speaking && !reduced) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: reduced ? 0 : 180 });
    }
    return () => cancelAnimation(pulse);
  }, [pulse, reduced, speaking]);

  const style = useAnimatedStyle(() => ({
    opacity: speaking ? 0.28 + (delay ? 1 - pulse.value : pulse.value) * 0.55 : 0.9,
    transform: [{ scale: 1 + (speaking && !reduced ? (delay ? pulse.value : 1 - pulse.value) * 0.07 : 0) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: speaking ? 2.5 : 1.5,
          borderColor: speaking ? colors.gold : colors.line,
        },
        style,
      ]}
    />
  );
}

export function AudioBars({ active, height = 22 }: { active: boolean; height?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height }} accessibilityElementsHidden>
      {[0, 1, 2, 3, 4].map((index) => (
        <AudioBar key={index} index={index} active={active} max={height} />
      ))}
    </View>
  );
}

function AudioBar({ index, active, max }: { index: number; active: boolean; max: number }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(4);

  useEffect(() => {
    if (!active || reduced) {
      h.value = withTiming(4, { duration: reduced ? 0 : 160 });
      return;
    }
    h.value = withRepeat(
      withTiming(Math.max(8, max - (index % 3) * 4), { duration: 280 + index * 80, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(h);
  }, [active, h, index, max, reduced]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[{ width: 3, borderRadius: 3, backgroundColor: active ? colors.gold : colors.line }, style]}
    />
  );
}

const ROLE_LABEL = {
  host: "Host",
  cohost: "Co-host",
  speaker: "Speaker",
  listener: "Listening",
} as const;

export function SpeakingAvatar({
  seat,
  size = 84,
}: {
  seat: RoomSeat;
  size?: number;
}) {
  const ring = size + 16;
  const showMark = seat.role === "host" || seat.role === "cohost";
  const label = seat.speaking ? `Speaking, ${seat.name}` : seat.muted && seat.role !== "listener" ? `${seat.name}, muted` : seat.name;

  return (
    <View style={{ width: 108, alignItems: "center", gap: 8 }} accessibilityLabel={`${label}, ${ROLE_LABEL[seat.role]}${seat.you ? ", you" : ""}`}>
      <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }}>
        <Ring size={ring} speaking={seat.speaking} delay={0} />
        <Ring size={ring - 8} speaking={seat.speaking} delay={1} />
        <Portrait name={seat.name} uri={seat.avatarUrl} size={size} />
        {seat.muted && seat.role !== "listener" ? (
          <View
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: colors.coralSoft,
              borderWidth: 2,
              borderColor: colors.stage,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MicrophoneSlash size={13} color={colors.coral} weight="bold" />
          </View>
        ) : null}
        {showMark ? (
          <View style={{ position: "absolute", left: -2, bottom: -2, borderRadius: 10, backgroundColor: colors.stage, padding: 2 }}>
            <CreatorMark mark={seat.creatorMark || seat.id} size={22} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, textAlign: "center" }}>
        {seat.you ? "You" : seat.name}
      </Text>
      <View
        style={{
          paddingHorizontal: 8,
          minHeight: 22,
          borderRadius: 999,
          backgroundColor: seat.role === "host" ? colors.hiSoft : seat.speaking ? colors.goldSoft : colors.mist,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 10,
            letterSpacing: 0.4,
            color: seat.role === "host" ? colors.hiInk : seat.speaking ? colors.honeyInk : colors.inkSoft,
          }}
        >
          {seat.speaking ? "Speaking" : ROLE_LABEL[seat.role].toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function Portrait({ name, uri, size }: { name: string; uri?: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const showImage = !!uri && !failed;
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandDeep,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showImage ? (
        <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.32, color: colors.white }}>{initials(name)}</Text>
      )}
    </View>
  );
}

export function ListenerPip({ seat, size = 40 }: { seat: RoomSeat; size?: number }) {
  return (
    <View
      accessibilityLabel={seat.you ? "You, listening" : `${seat.name}, listening`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: seat.you ? colors.brandDeep : colors.rosewoodSoft,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.32, color: seat.you ? colors.white : colors.brandDeep }}>
        {seat.you ? "You" : initials(seat.name)}
      </Text>
    </View>
  );
}

export function HostFace({
  name,
  uri,
  size = 36,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  return <Portrait name={name} uri={uri} size={size} />;
}
