import { useQuery } from "@tanstack/react-query";
import { photoUrl } from "@/lib/community-v2/api";
import { useAppStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Play, Package } from "@/components/icons";
import { colors, fonts, radii } from "@/constants/theme";

import { FocusCorners } from "./FocusCorners";

export function MediaFrame({
  uri,
  experiencePath,
  label,
  ratio = 4 / 5,
  compact,
  play,
  overlay,
  corners = true,
}: {
  uri?: string | null;
  experiencePath?: string | null;
  label: string;
  ratio?: number;
  compact?: boolean;
  play?: boolean;
  overlay?: boolean;
  corners?: boolean;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const needsSigning =
    !!experiencePath &&
    !/^(https?:|data:|blob:|file:|content:)/i.test(experiencePath);
  const signed = useQuery({
    queryKey: ["community-photo", uid, experiencePath],
    queryFn: () => photoUrl(experiencePath!),
    enabled: needsSigning,
    staleTime: 180000,
    gcTime: 240000,
    retry: 1,
  });
  const resolved = needsSigning ? signed.data : uri;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [resolved]);
  const hasImage = !!resolved && !failed;
  const r = compact ? 5 / 4 : ratio;
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: "100%",
        aspectRatio: r,
        borderRadius: radii.photo,
        overflow: "hidden",
        backgroundColor: colors.mist,
      }}
    >
      {hasImage ? (
        <Image
          onError={() => setFailed(true)}
          source={{ uri: resolved! }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={["#F7F0EB", "#EEE1D9", "#E7D5CD"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, padding: 22, justifyContent: "space-between" }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: "#FFFFFF99",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Package size={26} color={colors.brand} />
          </View>
          <Text
            numberOfLines={3}
            style={{
              fontFamily: fonts.serifBold,
              fontSize: compact ? 16 : 24,
              lineHeight: compact ? 22 : 28,
              color: colors.brandDeep,
              letterSpacing: -0.5,
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      )}
      {hasImage && (overlay || play) ? (
        <LinearGradient
          colors={["rgba(28,25,23,0)", "rgba(28,25,23,0.55)"]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "48%",
          }}
        />
      ) : null}
      {corners ? <FocusCorners selected ink={!hasImage} /> : null}
      {play ? (
        <View
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "rgba(255,255,255,0.94)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Play size={22} color={colors.brandDeep} weight="fill" />
        </View>
      ) : null}
    </View>
  );
}
