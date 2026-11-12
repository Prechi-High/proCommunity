import { createElement, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { Play } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { ORIENTATION_VIDEO_URL, orientationEmbed } from "@/lib/movement/first90";

import { useMovementPalette } from "./palette";

const CAPTION = "The orientation. For anyone arriving on any day of the First 90.";

export function OrientationFilm() {
  const palette = useMovementPalette();
  const embed = orientationEmbed(ORIENTATION_VIDEO_URL);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const ring = useSharedValue(1);
  useEffect(() => {
    if (reduce || playing) return;
    ring.value = withRepeat(withTiming(1.06, { duration: 1600 }), -1, true);
  }, [playing, reduce, ring]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: reduce ? 1 : ring.value }] }));
  const frame = {
    borderRadius: 28,
    overflow: "hidden" as const,
    backgroundColor: palette.dark ? "#1A1214" : "#F3E6DC",
    borderWidth: 1,
    borderColor: palette.line,
    aspectRatio: 16 / 9,
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={frame}>
        {playing && embed && Platform.OS === "web" ? (
          embed.kind === "file" ? (
            createElement("video", {
              src: embed.src,
              controls: true,
              autoPlay: true,
              playsInline: true,
              style: { width: "100%", height: "100%", background: "#1C1917" },
              title: embed.title,
            })
          ) : (
            createElement("iframe", {
              src: embed.src,
              title: embed.title,
              allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
              allowFullScreen: true,
              style: { width: "100%", height: "100%", border: 0, background: "#1C1917" },
            })
          )
        ) : (
          <Pressable
            accessibilityRole={embed ? "button" : "image"}
            accessibilityLabel={embed ? "Play the founder orientation" : "Orientation film. A place is held for it."}
            disabled={!embed}
            onPress={() => embed && setPlaying(true)}
            style={{ flex: 1 }}
          >
            <Image
              source={require("../../assets/brand/ultra-veil.jpg")}
              accessibilityIgnoresInvertColors
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Animated.View
                style={[
                  {
                    width: 74,
                    height: 74,
                    borderRadius: 37,
                    borderWidth: 1,
                    borderColor: "rgba(247,241,234,0.85)",
                    backgroundColor: "rgba(28,25,23,0.28)",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  ringStyle,
                ]}
              >
                <Play size={28} color="#F7F1EA" weight="fill" />
              </Animated.View>
            </View>
          </Pressable>
        )}
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.4, color: palette.gold }}>{embed ? "PLAY THE ORIENTATION" : "FILM TO COME"}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, color: palette.ink }}>
        {embed ? "Watch the map." : "A film will sit here."}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: palette.muted }}>{CAPTION}</Text>
    </View>
  );
}
