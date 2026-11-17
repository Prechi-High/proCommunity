import { Pressable, ScrollView, Text, View } from "react-native";

import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";

export type HomeFeedTab = "for-you" | "following" | "routines" | "products";

const TABS: { id: HomeFeedTab; label: string }[] = [
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
  { id: "routines", label: "Routines" },
  { id: "products", label: "Products" },
];

export function HomeFeedTabs({ active, onChange }: { active: HomeFeedTab; onChange: (tab: HomeFeedTab) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
      {TABS.map((tab) => {
        const on = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              hapticSelect();
              onChange(tab.id);
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: on ? "rgba(255,214,228,0.95)" : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: on ? fonts.semibold : fonts.medium,
                fontSize: 14,
                color: on ? "#3D0F15" : "rgba(255,248,244,0.88)",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}