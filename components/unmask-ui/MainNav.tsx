import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { House, MagnifyingGlass, Plus, UsersThree, User } from "@/components/icons";
import { fonts, livelyElevation, livelyRadii, livelySpace } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CreateSheet } from "./CreateSheet";

export function MainNav() {
  const r = useRouter();
  const rawPath = usePathname();
  const insets = useSafeAreaInsets();
  const path = rawPath.replace(/\/\([^/]+\)/g, "").replace(/\/index$/, "/") || "/";
  const [open, setOpen] = useState(false);
  const routes = [
    { label: "Home", href: "/", Icon: House },
    { label: "Updates", href: "/community", Icon: MagnifyingGlass },
    { label: "Create", href: null, Icon: Plus },
    { label: "Community", href: "/ask-community", Icon: UsersThree },
    { label: "You", href: "/you", Icon: User },
  ] as const;

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
          backgroundColor: "rgba(255,232,240,0.96)",
          borderWidth: 1,
          borderColor: "rgba(255,107,157,0.25)",
          ...livelyElevation.dock,
        }}
      >
        {routes.map(({ label, href, Icon }) => {
          const active =
            href === "/"
              ? path === "/"
              : href === "/community"
                ? path.startsWith("/community") || path.startsWith("/story")
                : href === "/ask-community"
                  ? path.startsWith("/ask-community") || path.startsWith("/question")
                  : !!href && path.startsWith(href);
          const create = !href;
          const activeColor = "#FF6B9D";
          const idleColor = "#8E6874";
          return (
            <Pressable
              key={label}
              accessibilityRole={create ? "button" : "tab"}
              accessibilityLabel={create ? "Create" : label}
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
                  colors={["#FF8BC8", "#FF6B9D"]}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
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
                  <Icon size={23} color={active ? activeColor : idleColor} weight={active ? "fill" : "regular"} />
                  <Text
                    style={{
                      fontFamily: active ? fonts.semibold : fonts.medium,
                      fontSize: 10,
                      color: active ? activeColor : idleColor,
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