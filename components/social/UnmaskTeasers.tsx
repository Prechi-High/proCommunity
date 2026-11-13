import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Lock, Sparkle } from "@/components/icons";
import { OrientationFilm } from "@/components/movement/OrientationFilm";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { first90 } from "@/lib/movement/first90";
import { hapticSelect } from "@/lib/haptics";
import { useRoomTone } from "@/lib/social/roomTone";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

type Tease = {
  id: string;
  hook: string;
  cta: string;
  badge: string;
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
      hook: "Had a bad experience with a product?",
      cta: "Ask the brand",
      badge: "Coming soon",
      locked: true,
      image: img("photo-1556228720-195a672e8a03"),
      explain:
        "After the First 90 you can send what happened to you straight to the brand — which product, your skin, how long you used it, and what changed. Not a star rating. Your Unmask, with context. Opens after the 90.",
    },
    {
      id: "expert",
      hook: "Not sure this product really works for you?",
      cta: "Ask an expert",
      badge: "Coming soon",
      locked: true,
      image: img("photo-1570172619644-dfd03ed5d881"),
      explain:
        "After the First 90 you can ask someone who knows the product about your exact skin and timeline — without guessing from ads. Your question carries your context. Opens after the 90.",
    },
    {
      id: "room",
      hook: "Want a live talk with the person you buy from?",
      cta: "Talk with the seller",
      badge: "Coming soon",
      locked: true,
      image: img("photo-1522335789203-aabd1fc54bc9"),
      explain:
        "Sellers will open audio rooms with people who actually use what they sell — experience after purchase, not a sales pitch. A bigger layer of Unmask lands after the First 90.",
    },
    {
      id: "store",
      hook: "Want to connect with users and build credibility for your store?",
      cta: "Create your store",
      badge: "Open now",
      image: img("photo-1596462502278-27bfdc403348"),
      href: "/offers",
      explain:
        "Open a store people can check before they buy — your offers, your face, your context. Live seller rooms join later after the 90.",
    },
    {
      id: "film",
      hook: "Unmask is bigger than a feed. See what we’re building.",
      cta: "See what Unmask is",
      badge: "Watch anytime",
      image: img("photo-1616683693504-3ea7e9ad6fec"),
      film: true,
      explain:
        "A short film maps the movement: who you are, what you use, what happened — and the next layer coming after the First 90. Tap play when you want the full picture.",
    },
  ];

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2, color: tone.faint, paddingHorizontal: 16 }}>
        {day} · tap a trailer slip — something bigger is coming
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
              width: 210,
              height: 112,
              borderRadius: 18,
              overflow: "hidden",
              borderWidth: 1,
              borderStyle: card.locked ? "dashed" : "solid",
              borderColor: card.locked ? tone.line : tone.gold,
            }}
          >
            <Image source={{ uri: card.image }} style={{ position: "absolute", width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
            <View style={{ flex: 1, backgroundColor: "rgba(10,4,8,0.72)", padding: 12, justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {card.locked ? <Lock size={11} color="#F0CF69" /> : <Sparkle size={11} color="#F0CF69" />}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8, color: "#F0CF69" }}>
                    {card.badge.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: "#FFF8F4" }}>
                  {card.hook}
                </Text>
                <View
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: card.locked ? "rgba(255,248,244,0.14)" : "rgba(240,207,105,0.92)",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 11,
                      color: card.locked ? "#FFF8F4" : "#1A0A14",
                    }}
                  >
                    {card.cta}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <ActionSheet open={!!open} title={open?.cta || ""} onClose={() => setOpen(null)}>
        {open ? (
          <View style={{ gap: 12 }}>
            <Image source={{ uri: open.image }} style={{ width: "100%", height: 140, borderRadius: 16 }} accessibilityIgnoresInvertColors />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: tone.gold }}>{open.badge} · {day}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, color: tone.text }}>{open.hook}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: tone.muted }}>{open.explain}</Text>
            {open.locked ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: tone.gold }}>
                Something big is coming after the First 90. Watch this space.
              </Text>
            ) : null}
            {open.href ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticSelect();
                  setOpen(null);
                  router.push(open.href as Href);
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: tone.gold }}>{open.cta}</Text>
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
