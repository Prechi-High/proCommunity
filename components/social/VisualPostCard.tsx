import { Image, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ChatCircle, Heart } from "@/components/icons";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { colors, fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import type { FeedItem } from "@/lib/unmask/feed";

export function VisualPostCard({
  item,
  variant = "card",
}: {
  item: FeedItem;
  variant?: "card" | "featured";
}) {
  const router = useRouter();
  const media = item.photo || item.productImage;
  const open = () => {
    hapticSelect();
    router.push(item.href as Href);
  };

  if (variant === "featured") {
    return (
      <Pressable accessibilityRole="link" onPress={open} style={{ borderRadius: livelyRadii.hero, overflow: "hidden" }}>
        <LinearGradient
          colors={["#1A0A14", "#2D1530", "#3D0F15"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20, gap: 14, minHeight: 280 }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.4, color: "#F0CF69" }}>
              {item.sample ? "SAMPLE · COMMUNITY" : "LIVE FROM UNMASK"}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              See feed →
            </Text>
          </View>
          {media ? (
            <Image
              source={{ uri: media }}
              accessibilityIgnoresInvertColors
              style={{ width: "100%", height: 200, borderRadius: livelyRadii.card }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <PersonAvatar id={item.authorId} name={item.author} size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>{item.author}</Text>
              <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.78)" }}>
                {item.title}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 18 }}>
            <Metric icon={Heart} label={`${item.likes ?? 128}`} />
            <Metric icon={ChatCircle} label="24" />
            {item.productName ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#F0CF69", alignSelf: "center" }}>
                · {item.productName}
              </Text>
            ) : null}
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={open}
      style={({ pressed }) => ({
        width: 260,
        borderRadius: livelyRadii.card,
        overflow: "hidden",
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {media ? (
        <Image source={{ uri: media }} style={{ width: "100%", height: 150 }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ height: 150, backgroundColor: colors.mist }} />
      )}
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PersonAvatar id={item.authorId} name={item.author} size={28} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, flex: 1 }} numberOfLines={1}>
            {item.author}
          </Text>
        </View>
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>
          {item.title}
        </Text>
        {item.sample ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.6, color: colors.brand }}>DESIGN EXAMPLE</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Metric({ icon: Icon, label }: { icon: typeof Heart; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon size={18} color="#FFF8F4" weight="fill" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>{label}</Text>
    </View>
  );
}
