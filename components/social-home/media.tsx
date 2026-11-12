import { Image, Text, View } from "react-native";

import { fonts } from "@/constants/theme";
import type { MediaSource } from "@/lib/social/model";

export function portraitSource(source: MediaSource): number | { uri: string } {
  return source;
}

export function Face({
  source,
  name,
  size,
}: {
  source: MediaSource | null;
  name: string;
  size: number;
}) {
  if (!source) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#3D0F15",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.38, color: "#F7F1EA" }}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={portraitSource(source)}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E7D9CF" }}
    />
  );
}
