import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";

import { Plus } from "@/components/icons";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { colors, fonts } from "@/constants/theme";
import { livelyRadii } from "@/constants/design-language";
import { hapticSelect } from "@/lib/haptics";
import { Pressable } from "react-native";

const RINGS = [
  ["#C9A227", "#70323E"],
  ["#236044", "#8FD2A8"],
  ["#70323E", "#C9A227"],
  ["#5C2834", "#F2DEAA"],
] as const;

type StorySeed = { id: string; name: string; label: string };

const SAMPLE: StorySeed[] = [
  { id: "s1", name: "Amina", label: "GRWM" },
  { id: "s2", name: "Temi", label: "Routine" },
  { id: "s3", name: "Zara", label: "New serum" },
];

export function StoryRail() {
  const router = useRouter();
  const go = (href: string) => {
    hapticSelect();
    router.push(href as Href);
  };
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 11,
          letterSpacing: 1.6,
          color: colors.brand,
          paddingHorizontal: 20,
        }}
      >
        RIGHT NOW
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingBottom: 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add your story moment"
              onPress={() => go("/moment")}
          style={{ alignItems: "center", width: 76, gap: 8 }}
        >
          <LinearGradient
            colors={[colors.brandDeep, colors.brand]}
            style={{
              width: 68,
              height: 68,
              borderRadius: livelyRadii.story,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                backgroundColor: glassCenter(),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={28} color={colors.brandDeep} weight="bold" />
            </View>
          </LinearGradient>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>
            Your moment
          </Text>
        </Pressable>
        {SAMPLE.map((item, index) => {
          const ring = RINGS[index % RINGS.length];
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => go("/community")}
              style={{ alignItems: "center", width: 76, gap: 8 }}
            >
              <LinearGradient
                colors={[ring[0], ring[1]]}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: livelyRadii.story,
                  padding: 3,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: livelyRadii.story - 2,
                    backgroundColor: colors.white,
                    padding: 2,
                  }}
                >
                  <PersonAvatar id={item.id} name={item.name} size={58} />
                </View>
              </LinearGradient>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function glassCenter() {
  return "rgba(255,255,255,0.92)";
}
