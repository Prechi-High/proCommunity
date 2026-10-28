import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, Lightning } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
export function TakeFurtherCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Take this further with Ultra Unmask"
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <LinearGradient
        colors={["#F7EBD4", "#F2E4ED"]}
        style={{
          padding: 21,
          borderRadius: 23,
          borderWidth: 1,
          borderColor: "#E3CDD7",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <View
            style={{
              padding: 10,
              borderRadius: 14,
              backgroundColor: colors.brandDeep,
            }}
          >
            <Lightning size={22} weight="fill" color="#F4D581" />
          </View>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 20,
              color: colors.ink,
              flex: 1,
            }}
          >
            There’s more to this story.
          </Text>
          <ArrowUpRight size={22} color={colors.brandDeep} />
        </View>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            lineHeight: 23,
            color: colors.inkSoft,
          }}
        >
          Ask for a closer look. Creators can bring in experts, seek a company
          response, and share what they find.
        </Text>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 14,
            color: colors.brandDeep,
          }}
        >
          Take it further with Ultra Unmask →
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 12,
            lineHeight: 18,
            color: colors.inkSoft,
          }}
        >
          Start with your Sparks. The community can join you. Selection and
          replies aren’t guaranteed.
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
