import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { ArrowRight, Camera, Clock, Package } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { GlassCard } from "@/components/lively";
import { livelyElevation } from "@/constants/design-language";
import { IDENTITY_PROMPTS, SOCIAL_IDENTITY } from "@/lib/social/identity";

const icons = [Camera, Package, Clock];

export function IdentityPrompts() {
  const router = useRouter();
  return (
    <View style={{ gap: 12, paddingHorizontal: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.4, color: colors.brand }}>
          {SOCIAL_IDENTITY.eyebrow}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
          {SOCIAL_IDENTITY.habitLine}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {IDENTITY_PROMPTS.map((item, index) => {
          const Icon = icons[index] ?? Camera;
          return (
            <Pressable
              key={item.title}
              accessibilityRole="link"
              onPress={() => {
                hapticSelect();
                router.push(item.href as Href);
              }}
              style={({ pressed }) => ({
                width: 200,
                minHeight: 128,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <GlassCard padded style={{ minHeight: 128, gap: 10, ...livelyElevation.card }}>
              <Icon size={22} color={colors.brandDeep} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.ink }}>
                {item.title}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>
                {item.line}
              </Text>
              <ArrowRight size={16} color={colors.brand} />
              </GlassCard>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
