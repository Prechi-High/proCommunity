import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

import { Skeleton } from "./Skeleton";
import { colors, fonts } from "@/constants/theme";
import { avatarTone, initials } from "@/lib/unmask/time";

export function Avatar({
  name,
  uri,
  size = 36,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const bg = avatarTone(name);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [uri]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel={name || "Person"}
    >
      {uri && !failed ? (
        <Image
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          source={{ uri }}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: size * 0.36,
            color: colors.white,
            letterSpacing: 0.2,
          }}
        >
          {initials(name)}
        </Text>
      )}
      {uri && !failed && !loaded ? (
        <View style={{ position: "absolute", inset: 0 }}>
          <Skeleton width={size} height={size} radius={size / 2} />
        </View>
      ) : null}
    </View>
  );
}
