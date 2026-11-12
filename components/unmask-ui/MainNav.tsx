import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { House, UsersThree, Plus, Package, User } from "@/components/icons";
import { fonts, livelyElevation, livelyRadii, livelySpace } from "@/constants/theme";
import { useRoomTone } from "@/lib/social/roomTone";
import { hapticSelect } from "@/lib/haptics";
import { CreateSheet } from "./CreateSheet";

export function MainNav() {
  const r = useRouter(),
    rawPath = usePathname(),
    insets = useSafeAreaInsets();
  const path =
    rawPath.replace(/\/\([^/]+\)/g, "").replace(/\/index$/, "/") || "/";
  const tone = useRoomTone();
  const [open, setOpen] = useState(false);
  const routes = [
    { label: "Home", href: "/", Icon: House },
    { label: "Community", href: "/community", Icon: UsersThree },
    { label: "Create", href: null, Icon: Plus },
    { label: "My Unmask", href: "/products", Icon: Package },
    { label: "You", href: "/you", Icon: User },
  ];
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
          maxWidth: 780,
          width: "100%",
          alignSelf: "center",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderRadius: livelyRadii.dock,
          backgroundColor: tone.dock,
          borderWidth: 1,
          borderColor: tone.line,
          ...livelyElevation.dock,
        }}
      >
        {routes.map(({ label, href, Icon }) => {
          const active =
            href === "/"
              ? path === "/"
              : href === "/community"
                ? ["/community", "/story", "/question", "/creators", "/member"].some((prefix) => path.startsWith(prefix))
                : href === "/products"
                  ? path.startsWith("/products") || path.startsWith("/journey")
                  : !!href && path.startsWith(href);
          const create = !href;
          return (
            <Pressable
              key={label}
              accessibilityRole={create ? "button" : "tab"}
              accessibilityLabel={
                create ? "Create: share, ask or track" : label
              }
              accessibilityState={{ selected: active }}
              onPress={() => {
                hapticSelect();
                if (create) setOpen(true);
                else r.navigate(href as Href);
              }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                minHeight: 52,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              {create ? (
                <LinearGradient
                  colors={["#3D0F15", "#70323E"]}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    transform: [{ translateY: -14 }],
                    ...livelyElevation.fab,
                  }}
                >
                  <Icon size={28} color="#fff" weight="bold" />
                </LinearGradient>
              ) : (
                <>
                  <View
                    style={{
                      width: 40,
                      height: 32,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? "rgba(240,207,105,0.16)" : "transparent",
                    }}
                  >
                    <Icon
                      size={23}
                      color={active ? tone.gold : tone.muted}
                      weight={active ? "fill" : "regular"}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: active ? fonts.semibold : fonts.medium,
                      fontSize: 10,
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
      <CreateSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}
