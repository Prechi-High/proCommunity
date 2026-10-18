import { Tabs } from "expo-router";
import {
  House,
  MagnifyingGlass,
  Package,
  UsersThree,
  User,
} from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.bone3,
        tabBarStyle: {
          backgroundColor: colors.wine,
          width: "100%",
          maxWidth: 1160,
          alignSelf: "center",
          borderTopColor: colors.line,
          height: 80,
          paddingTop: 12,
          paddingBottom: 14,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => (
            <House
              size={23}
              color={String(color)}
              weight={focused ? "fill" : "regular"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="unmask"
        options={{
          title: "Unmask",
          tabBarIcon: ({ color, focused }) => (
            <MagnifyingGlass
              size={23}
              color={String(color)}
              weight={focused ? "bold" : "regular"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "My Products",
          tabBarIcon: ({ color, focused }) => (
            <Package
              size={23}
              color={String(color)}
              weight={focused ? "fill" : "regular"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pulse"
        options={{
          title: "Community",
          tabBarIcon: ({ color, focused }) => (
            <UsersThree
              size={23}
              color={String(color)}
              weight={focused ? "fill" : "regular"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => (
            <User
              size={23}
              color={String(color)}
              weight={focused ? "fill" : "regular"}
            />
          ),
        }}
      />
      <Tabs.Screen name="saved" options={{ href: null }} />
    </Tabs>
  );
}
