import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { sampleMark, type UnmaskCard } from "@/lib/social/model";
import { useMovementPalette } from "@/components/movement/palette";

import { Face } from "./media";

export function MyUnmaskCard({
  card,
  self = false,
  guest = false,
}: {
  card: UnmaskCard;
  self?: boolean;
  guest?: boolean;
}) {
  const palette = useMovementPalette();
  const router = useRouter();
  const mark = sampleMark(card);
  const bare = !card.skin && !card.hair && !card.routine && !card.products.length && !card.timelines.length && !card.goals;
  const openShelf = () => {
    hapticSelect();
    router.push("/products" as Href);
  };
  const openTimeline = (id: string) => {
    if (card.sample) return;
    hapticSelect();
    router.push(`/journey/${id}` as Href);
  };
  return (
    <View
      style={{
        borderRadius: 28,
        padding: 18,
        gap: 14,
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.line,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Face source={card.avatar} name={card.name} size={64} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, color: palette.gold }}>
            {mark ? "SAMPLE · MY UNMASK" : "MY UNMASK"}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4, color: palette.ink }}>
            {card.name}
          </Text>
          {card.handle ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.muted }}>@{card.handle}</Text>
          ) : null}
        </View>
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: palette.wine }}>This is my Unmask.</Text>
      {bare ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: palette.muted }}>
          Skin, routine, and what you use. Share it when you want someone to check your Unmask.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {card.skin ? <Line label="Skin" value={card.skin} /> : null}
          {card.hair ? <Line label="Hair" value={card.hair} /> : null}
          {card.routine ? <Line label="Routine" value={card.routine} /> : null}
          {card.goals ? <Line label="Looking for" value={card.goals} /> : null}
        </View>
      )}
      {card.concerns.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {card.concerns.map((concern) => (
            <View key={concern} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: palette.quiet }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: palette.ink }}>{concern}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {card.products.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>What I use</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
            {card.products.map((product) => (
              <Pressable
                key={product.id}
                accessibilityRole="button"
                accessibilityLabel={product.name}
                onPress={openShelf}
                style={{ width: 156, minHeight: 84, borderRadius: 18, padding: 14, backgroundColor: palette.quiet, justifyContent: "flex-end" }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: palette.ink }}>{product.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {card.timelines.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>What happened</Text>
          {card.timelines.map((timeline) => (
            <Pressable
              key={timeline.id}
              accessibilityRole="button"
              accessibilityLabel={timeline.label}
              onPress={() => openTimeline(timeline.id)}
              style={{ minHeight: 48, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: palette.line }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: palette.ink }}>{timeline.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {self ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit my Unmask"
          onPress={() => {
            hapticSelect();
            router.push("/card/edit" as Href);
          }}
          style={{ minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.button }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.buttonText }}>Edit my Unmask</Text>
        </Pressable>
      ) : null}
      {guest ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get Started"
          onPress={() => {
            hapticSelect();
            router.push("/sign-up" as Href);
          }}
          style={{ minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.button }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.buttonText }}>Get Started</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const palette = useMovementPalette();
  return (
    <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: palette.ink }}>
      <Text style={{ fontFamily: fonts.semibold }}>{label}. </Text>
      {value}
    </Text>
  );
}
