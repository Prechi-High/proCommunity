import { Pressable, ScrollView, Text, View } from "react-native";

import { colors, elevation, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";

export function FilterChips({
  options,
  value,
  onChange,
  variant = "segment",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  variant?: "segment" | "chips";
}) {
  if (variant === "chips") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {options.map((opt) => {
          const on = opt === value;
          return (
            <Pressable
              key={opt}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                hapticSelect();
                onChange(opt);
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? colors.brandDeep : colors.mist,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 14,
                  color: on ? colors.white : colors.ink,
                }}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.mist,
        borderRadius: 14,
        padding: 3,
      }}
    >
      {options.map((opt) => {
        const on = opt === value;
        return (
          <Pressable
            key={opt}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              hapticSelect();
              onChange(opt);
            }}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? colors.white : "transparent",
              ...(on ? elevation.raised : {}),
            }}
          >
            <Text
              style={{
                fontFamily: on ? fonts.semibold : fonts.medium,
                fontSize: 14,
                color: on ? colors.ink : colors.inkSoft,
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
