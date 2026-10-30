import { Pressable, Text, View } from "react-native";

import { colors, fonts } from "@/constants/theme";
import { initials } from "@/lib/unmask/time";

import { AudioBars } from "./SpeakingAvatar";

export function SpacePill({
  title,
  count,
  hostName,
  onPress,
}: {
  title: string;
  count: number;
  hostName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count} listening`}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        maxWidth: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingRight: 12,
        paddingLeft: 4,
        minHeight: 40,
        borderRadius: 999,
        backgroundColor: colors.brandDeep,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>{initials(hostName)}</Text>
      </View>
      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>+{count} · {title}</Text>
      <AudioBars active height={14} />
    </Pressable>
  );
}

export function SpaceCard({
  title,
  hostName,
  hostHandle,
  count,
  product,
  onPress,
}: {
  title: string;
  hostName: string;
  hostHandle?: string | null;
  count: number;
  product?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hostName} is hosting. ${count} listening. Listen live.`}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 18,
        backgroundColor: colors.brandDeep,
        padding: 14,
        gap: 10,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>{initials(hostName)}</Text>
        </View>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>{hostName}</Text>
        <View style={{ paddingHorizontal: 8, minHeight: 22, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>Host</Text>
        </View>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: colors.white }}>{title}</Text>
      {product ? <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.gold }}>{product}</Text> : null}
      {hostHandle ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.gold }}>@{hostHandle}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.brandDeep }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>{count} listening</Text>
      </View>
      <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
        <AudioBars active={false} height={14} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Listen live</Text>
      </View>
    </Pressable>
  );
}
