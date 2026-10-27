import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, UsersThree, Plus, Package, User } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CreateSheet } from "./CreateSheet";
export function MainNav() {
  const r = useRouter(),
    rawPath = usePathname(),
    insets = useSafeAreaInsets();
  const path =
    rawPath.replace(/\/\([^/]+\)/g, "").replace(/\/index$/, "/") || "/";
  const [open, setOpen] = useState(false);
  const routes = [
    { label: "Home", href: "/", Icon: House },
    { label: "Community", href: "/community", Icon: UsersThree },
    { label: "Create", href: null, Icon: Plus },
    { label: "My Products", href: "/products", Icon: Package },
    { label: "You", href: "/you", Icon: User },
  ];
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#EBE3DE",
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
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
        }}
      >
        {routes.map(({ label, href, Icon }) => {
          const active =
            href === "/"
              ? path === "/"
              : href === "/community"
                ? ["/community", "/story", "/question", "/investigation", "/ultra-unmask", "/creators", "/member"].some(prefix => path.startsWith(prefix))
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
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={
                  create
                    ? {
                        width: 50,
                        height: 50,
                        borderRadius: 18,
                        backgroundColor: colors.brandDeep,
                        alignItems: "center",
                        justifyContent: "center",
                        transform: [{ translateY: -3 }],
                        boxShadow: "0px 4px 12px rgba(68,20,35,.18)",
                      }
                    : { height: 28, justifyContent: "center" }
                }
              >
                <Icon
                  size={create ? 27 : 23}
                  color={
                    create ? "#fff" : active ? colors.brandDeep : colors.inkSoft
                  }
                  weight={create ? "bold" : active ? "fill" : "regular"}
                />
              </View>
              {!create ? (
                <Text
                  style={{
                    fontFamily: active ? fonts.semibold : fonts.medium,
                    fontSize: 11,
                    color: active ? colors.brandDeep : colors.inkSoft,
                  }}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <CreateSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}
