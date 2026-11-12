import { Pressable, ScrollView, Text, View } from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { colors, elevation, fonts, glass, livelyRadii, livelyGradients } from "@/constants/theme";
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
                paddingHorizontal: 16,
                borderRadius: livelyRadii.chip,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                backgroundColor: on ? "transparent" : glass.fill,
                borderWidth: 1,
                borderColor: on ? "transparent" : glass.strokeMuted,
                ...(!on ? elevation.raised : {}),
              }}
            >
              {on ? (
                <LinearGradient
                  colors={[...livelyGradients.action]}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                  }}
                />
              ) : null}
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 14,
                  color: on ? "#F7F1EA" : colors.ink,
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
              minHeight: 52,
              paddingHorizontal: 14,
              paddingVertical: 12,
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
                lineHeight: 20,
                textAlign: "center",
                flexShrink: 1,
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
