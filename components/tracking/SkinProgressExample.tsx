import { useState } from "react";
import { Image, Text, View } from "react-native";
import { Skeleton } from "@/components/unmask-ui";
import { colors, fonts } from "@/constants/theme";
export function SkinProgressExample() {
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          borderRadius: 20,
          overflow: "hidden",
          aspectRatio: 5 / 3,
          backgroundColor: colors.mist,
        }}
      >
        {!failed ? (
          <Image
            source={require("@/assets/journal/skin-progress-example.webp")}
            accessibilityLabel="Illustrative example of the same woman in Week 1 and Week 3, with a subtle change in cheek texture in the later photo."
            resizeMode="contain"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              setLoaded(true);
            }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View style={{ padding: 20 }}>
            <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
              Compare your starting photo with a later update.
            </Text>
          </View>
        )}
        {!loaded ? (
          <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
            <Skeleton height={500} radius={20} />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {["Week 1 · Starting photo", "Week 3 · Later update"].map((label) => (
          <Text
            key={label}
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: fonts.semibold,
              fontSize: 12,
              lineHeight: 18,
              color: colors.ink,
            }}
          >
            {label}
          </Text>
        ))}
      </View>
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 12,
          lineHeight: 18,
          color: colors.inkSoft,
        }}
      >
        AI-generated example, not a member’s results. Your photos may show
        improvement, no change, or a different effect.
      </Text>
    </View>
  );
}
