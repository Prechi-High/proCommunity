import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { fonts, livelyElevation, livelyRadii, livelySpace } from "@/constants/theme";
import { useRoomTone } from "@/lib/social/roomTone";
import { hapticSelect } from "@/lib/haptics";
import { VISION_NAV, navActive } from "@/lib/navigation/visionNav";

export function MainNav() {
  const r = useRouter();
  const rawPath = usePathname();
  const insets = useSafeAreaInsets();
  const path = rawPath.replace(/\/\([^/]+\)/g, "").replace(/\/index$/, "/") || "/";
  const tone = useRoomTone();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: livelySpace.dockInset,
        right: livelySpace.dockInset,
        bottom: Math.max(insets.bottom, 10),
        alignItems: "center",
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          maxWidth: 820,
          width: "100%",
          alignSelf: "center",
          alignItems: "flex-end",
          paddingVertical: 8,
          paddingHorizontal: 4,
          borderRadius: livelyRadii.dock,
          backgroundColor: tone.dock,
          borderWidth: 1,
          borderColor: tone.line,
          ...livelyElevation.dock,
        }}
      >
        {VISION_NAV.map((item) => {
          const fab = "fab" in item && item.fab;
          const active = item.href ? navActive(path, item.href) : false;
          const { label, detail, href, Icon } = item;

          return (
            <Pressable
              key={item.id}
              accessibilityRole={fab ? "button" : "tab"}
              accessibilityLabel={`${label}. ${detail}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                hapticSelect();
                r.navigate(href as Href);
              }}
              style={({ pressed }) => ({
                flex: fab ? 0 : 1,
                minWidth: fab ? 56 : undefined,
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 2,
                minHeight: fab ? 64 : 48,
                opacity: pressed ? 0.8 : 1,
                paddingHorizontal: fab ? 6 : 2,
              })}
            >
              {fab ? (
                <LinearGradient
                  colors={["#3D0F15", "#70323E"]}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    transform: [{ translateY: -12 }],
                    ...livelyElevation.fab,
                  }}
                >
                  <Icon size={26} color="#fff" weight="bold" />
                </LinearGradient>
              ) : (
                <>
                  <View
                    style={{
                      width: 36,
                      height: 28,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? "rgba(240,207,105,0.16)" : "transparent",
                    }}
                  >
                    <Icon size={21} color={active ? tone.gold : tone.muted} weight={active ? "fill" : "regular"} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: active ? fonts.semibold : fonts.medium,
                      fontSize: 9,
                      lineHeight: 11,
                      color: active ? tone.gold : tone.muted,
                    }}
                  >
                    {label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}