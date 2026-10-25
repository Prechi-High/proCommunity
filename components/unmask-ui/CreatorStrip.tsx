import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Sparkle } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";

import { Avatar } from "./Avatar";

type Creator = {
  user_id: string;
  display_name: string;
  handle?: string | null;
  avatar_url?: string | null;
};

export function CreatorStrip({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  if (!creators.length) {
    return (
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 15,
          lineHeight: 22,
          color: colors.inkSoft,
          paddingHorizontal: 20,
        }}
      >
        Creator profiles will appear here as they join Unmask.
      </Text>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingHorizontal: 20 }}
    >
      {creators.map((c) => (
        <Pressable
          key={c.user_id}
          onPress={() => router.push(`/member/${c.user_id}` as Href)}
          accessibilityRole="link"
          accessibilityLabel={`View creator ${c.display_name}`}
          style={({ pressed }) => ({
            width: 128,
            alignItems: "center",
            gap: 8,
            padding: 16,
            borderRadius: 20,
            backgroundColor: pressed ? "#EDE0DA" : "#F7F2ED",
          })}
        >
          <View
            style={{
              padding: 3,
              borderRadius: 40,
              borderWidth: 1,
              borderColor: colors.brand,
            }}
          >
            <Avatar name={c.display_name} uri={c.avatar_url} size={60} />
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: colors.ink,
              textAlign: "center",
            }}
          >
            {c.display_name}
          </Text>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Sparkle size={12} color={colors.brand} />
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 11,
                color: colors.brand,
              }}
            >
              Unmask Creator
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
