import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, UsersThree, Plus, Package, User } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CreateSheet } from "./CreateSheet";

export function MainNav() {
  const r = useRouter(), rawPath = usePathname(), insets = useSafeAreaInsets();
  const path = rawPath.replace(/\/\([^/]+\)/g, "").replace(/\/index$/, "/") || "/";
  const [open, setOpen] = useState(false);
  const routes = [
    { label: "Home", href: "/", Icon: House },
    { label: "Community", href: "/community", Icon: UsersThree },
    { label: "Create", href: null, Icon: Plus },
    { label: "Products", href: "/products", Icon: Package },
    { label: "You", href: "/you", Icon: User },
  ];
  return (
    <View style={{ backgroundColor: "#0E1729", borderTopWidth: 1, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 7 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", maxWidth: 780, width: "100%", alignSelf: "center", alignItems: "center" }}>
        {routes.map(({ label, href, Icon }) => {
          const active = href === "/" ? path === "/" : href === "/community"
            ? ["/community", "/story", "/question", "/investigation", "/ultra-unmask", "/creators", "/member"].some(prefix => path.startsWith(prefix))
            : href === "/products" ? path.startsWith("/products") || path.startsWith("/journey") : !!href && path.startsWith(href);
          const create = !href;
          return (
            <Pressable key={label} accessibilityRole={create ? "button" : "tab"} accessibilityLabel={create ? "Create: share, ask or track" : label}
              accessibilityState={{ selected: active }} onPress={() => { hapticSelect(); if (create) setOpen(true); else r.navigate(href as Href); }}
              style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 4, minHeight: 54, opacity: pressed ? 0.72 : 1 })}>
              <View style={create
                ? { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center", transform: [{ translateY: -2 }] }
                : { height: 27, minWidth: 42, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: active ? "#252044" : "transparent" }}>
                <Icon size={create ? 23 : 21} color={create ? "#FFFFFF" : active ? "#B7A7FF" : "#8996AF"} weight={create ? "bold" : active ? "fill" : "regular"} />
              </View>
              {!create ? <Text style={{ fontFamily: active ? fonts.semibold : fonts.medium, fontSize: 10, color: active ? "#C4B8FF" : "#8996AF" }}>{label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <CreateSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}
