import { Pressable, Text, View } from "react-native";
import { useAppStore } from "@/lib/store";
import { colors, fonts } from "@/constants/theme";
import { Sparkle } from "@/components/icons";
export function DemoBanner() {
  const on = useAppStore((s) => s.demoCommunity);
  const set = useAppStore((s) => s.setDemoCommunity);
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: on ? "#FFF4D9" : "#F5F1EE",
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Sparkle size={18} color={colors.brand} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.semibold,
            color: colors.brand,
            fontSize: 14,
          }}
        >
          {on ? "Demo community is on" : "See Unmask with a community"}
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          accessibilityLabel="Demo community"
          onPress={() => set(!on)}
          style={{ padding: 10 }}
        >
          <Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>
            {on ? "Turn off" : "Preview"}
          </Text>
        </Pressable>
      </View>
      {on ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 12,
            lineHeight: 18,
            color: colors.inkSoft,
          }}
        >
          Fictional people, products and activity. Illustration photos. No real
          payments or product claims.
        </Text>
      ) : null}
    </View>
  );
}
