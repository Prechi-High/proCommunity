import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Plus } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { personUnseen, sampleMark, type RailPerson } from "@/lib/social/model";

import { Face } from "./media";
import { useMovementPalette } from "@/components/movement/palette";

const RING = 78;

function Ring({
  unseen,
  children,
}: {
  unseen: boolean;
  children: ReactNode;
}) {
  const palette = useMovementPalette();
  if (!unseen) {
    return (
      <View style={{ width: RING, height: RING, borderRadius: RING / 2, padding: 3, backgroundColor: palette.line }}>
        <View style={{ flex: 1, borderRadius: RING, padding: 2, backgroundColor: palette.card, alignItems: "center", justifyContent: "center" }}>
          {children}
        </View>
      </View>
    );
  }
  return (
    <LinearGradient
      colors={palette.dark ? ["#F0CF69", "#E7C4CE"] : ["#3D0F15", "#C9A227"]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ width: RING, height: RING, borderRadius: RING / 2, padding: 3 }}
    >
      <View style={{ flex: 1, borderRadius: RING, padding: 2, backgroundColor: palette.card, alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </LinearGradient>
  );
}

export function StoryRail({
  people,
  samples,
  seen,
  onOpen,
  onAdd,
}: {
  people: RailPerson[];
  samples: boolean;
  seen: ReadonlySet<string>;
  onOpen: (authorId: string) => void;
  onAdd: () => void;
}) {
  const palette = useMovementPalette();
  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingRight: 48 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your story. Add a photo or short video."
          onPress={() => {
            hapticSelect();
            onAdd();
          }}
          style={{ width: 84, alignItems: "center", gap: 6 }}
        >
          <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                borderWidth: 1.5,
                borderColor: palette.wine,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.quiet,
              }}
            >
              <Plus size={26} color={palette.wine} weight="bold" />
            </View>
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: palette.ink }}>Your story</Text>
        </Pressable>
        {people.map((person) => {
          const mark = samples ? sampleMark(person) : null;
          const unseen = personUnseen(person, seen);
          return (
            <Pressable
              key={person.authorId}
              accessibilityRole="button"
              accessibilityLabel={mark ? `${person.author}, sample story` : `${person.author}'s story`}
              onPress={() => {
                hapticSelect();
                onOpen(person.authorId);
              }}
              style={{ width: 84, alignItems: "center", gap: 6 }}
            >
              <Ring unseen={unseen}>
                <Face source={person.avatar} name={person.author} size={64} />
              </Ring>
              <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12, color: palette.ink }}>
                {person.author}
              </Text>
              {mark ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.4, color: palette.gold }}>{mark}</Text>
              ) : (
                <View style={{ height: 12 }} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {samples ? (
        <Text style={{ paddingHorizontal: 20, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: palette.muted }}>
          Samples · imagined people. A real story is never labeled this way.
        </Text>
      ) : null}
    </View>
  );
}
