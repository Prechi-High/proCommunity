import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Lock } from "@/components/icons";
import { OrientationFilm } from "@/components/movement/OrientationFilm";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { first90 } from "@/lib/movement/first90";
import { hapticSelect } from "@/lib/haptics";
import { useRoomTone } from "@/lib/social/roomTone";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

type Tease = {
  id: string;
  kicker: string;
  title: string;
  line: string;
  locked?: boolean;
  image: string;
  explain: string;
  href?: string;
  film?: boolean;
};

export function UnmaskTeasers() {
  const tone = useRoomTone();
  const router = useRouter();
  const movement = first90();
  const day =
    movement.status === "during"
      ? `Day ${movement.day} of 90`
      : movement.status === "complete"
        ? "The First 90 is complete"
        : "Before Day 1";
  const [open, setOpen] = useState<Tease | null>(null);
  const [film, setFilm] = useState(false);

  const cards: Tease[] = [
    {
      id: "brand",
      kicker: "After the 90",
      title: "Ask the brand",
      line: "About what happened to you",
      locked: true,
      image: img("photo-1556228720-195a672e8a03"),
      explain:
        "You used a product and something happened. After the First 90 you can send that to the brand with the context attached: which product, your skin, how long you used it, and what changed. They are not guessing from a star rating. They see your Unmask. Nothing is sent today.",
    },
    {
      id: "expert",
      kicker: "After the 90",
      title: "Ask an expert",
      line: "Someone who knows this product",
      locked: true,
      image: img("photo-1570172619644-dfd03ed5d881"),
      explain:
        "Some questions are not for the brand. They are for a person who understands the product. After the First 90 you can ask that person about your exact experience, with your timeline beside the question. This stays closed until then.",
    },
    {
      id: "room",
      kicker: "After the 90",
      title: "Talk with the seller",
      line: "An audio room, not a checkout",
      locked: true,
      image: img("photo-1522335789203-aabd1fc54bc9"),
      explain:
        "A seller will be able to open a room and talk with people who actually use what they sell. The point is the experience after you buy, not a pitch. Rooms stay closed through the First 90.",
    },
    {
      id: "store",
      kicker: "Open now",
      title: "Create your store",
      line: "A place people can check",
      image: img("photo-1596462502278-27bfdc403348"),
      href: "/offers",
      explain:
        "A store here is a place someone can look at before they buy. You can open that side now. Talking with customers in a room waits until after the First 90.",
    },
    {
      id: "film",
      kicker: "The map",
      title: "What Unmask is",
      line: "A short film, any day of the 90",
      image: img("photo-1616683693504-3ea7e9ad6fec"),
      film: true,
      explain:
        "One film explains the whole movement: context before a conclusion, one product, a timeline, and the deeper layer that comes after the 90. Watch it whenever you arrive.",
    },
  ];

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2, color: tone.faint, paddingHorizontal: 16 }}>
        {day} · tap a slip to see what it means
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {cards.map((card) => (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            onPress={() => {
              hapticSelect();
              setOpen(card);
            }}
            style={{
              width: 196,
              height: 86,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderStyle: card.locked ? "dashed" : "solid",
              borderColor: card.locked ? tone.line : tone.gold,
              opacity: card.locked ? 0.92 : 1,
            }}
          >
            <Image source={{ uri: card.image }} style={{ position: "absolute", width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
            <View style={{ flex: 1, backgroundColor: "rgba(12,6,10,0.62)", padding: 10, justifyContent: "flex-end", gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {card.locked ? <Lock size={11} color="#F0CF69" /> : null}
                <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: "#F0CF69" }}>{card.kicker.toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>{card.title}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: "rgba(255,248,244,0.82)" }}>{card.line}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <ActionSheet open={!!open} title={open?.title || ""} onClose={() => setOpen(null)}>
        {open ? (
          <View style={{ gap: 12 }}>
            <Image source={{ uri: open.image }} style={{ width: "100%", height: 140, borderRadius: 16 }} accessibilityIgnoresInvertColors />
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: tone.text }}>{open.explain}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: tone.gold }}>
              {open.locked ? `${day}. This does not open yet.` : day}
            </Text>
            {open.href ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticSelect();
                  setOpen(null);
                  router.push(open.href as Href);
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: tone.gold }}>Open the store side</Text>
              </Pressable>
            ) : null}
            {open.film ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticSelect();
                  setOpen(null);
                  setFilm(true);
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: tone.gold }}>Play the film</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ActionSheet>
      {film ? (
        <View style={{ paddingHorizontal: 16 }}>
          <OrientationFilm />
        </View>
      ) : null}
    </View>
  );
}
