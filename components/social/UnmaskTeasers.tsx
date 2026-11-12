import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Play } from "@/components/icons";
import { OrientationFilm } from "@/components/movement/OrientationFilm";
import { fonts } from "@/constants/theme";
import { first90 } from "@/lib/movement/first90";
import { useRoomTone } from "@/lib/social/roomTone";
import { hapticSelect } from "@/lib/haptics";

const CARD_W = 248;

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
  const [film, setFilm] = useState(false);

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.6, color: tone.gold, paddingHorizontal: 16 }}>
        WHAT UNMASK BECOMES
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
        <Card title="Had a bad experience with a product?" tone={tone}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: tone.muted }}>
            Your question can go to the people behind it. Not a review form. A real ask.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Locked label="Ask the brand" tone={tone} />
            <Locked label="Ask an expert" tone={tone} />
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: tone.gold }}>{day} · opens after the First 90</Text>
        </Card>
        <Card title="Want customers who trust the store?" tone={tone}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: tone.muted }}>
            Sellers will be able to open an audio room and talk with the people using what they sell.
          </Text>
          <Locked label="Create audio room" tone={tone} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: tone.gold }}>{day} · rooms open after the First 90</Text>
        </Card>
        <Card title="Start the store people can check." tone={tone}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: tone.muted }}>
            Credibility first. Customer rooms come later. You can open the store side now.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticSelect();
              router.push("/offers" as Href);
            }}
            style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#3D0F15" }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>Create your store</Text>
          </Pressable>
        </Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticSelect();
            setFilm((v) => !v);
          }}
          style={{
            width: CARD_W,
            minHeight: 168,
            borderRadius: 22,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: tone.line,
            backgroundColor: "#1A0A14",
            padding: 14,
            justifyContent: "flex-end",
            gap: 6,
          }}
        >
          <Play size={22} color="#F0CF69" weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>What Unmask is</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: "rgba(255,248,244,0.72)" }}>
            A short film for the whole movement. Tap to open the player.
          </Text>
        </Pressable>
      </ScrollView>
      {film ? (
        <View style={{ paddingHorizontal: 16 }}>
          <OrientationFilm />
        </View>
      ) : null}
    </View>
  );
}

function Card({
  title,
  children,
  tone,
}: {
  title: string;
  children: ReactNode;
  tone: ReturnType<typeof useRoomTone>;
}) {
  return (
    <View
      style={{
        width: CARD_W,
        minHeight: 168,
        borderRadius: 22,
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: tone.line,
        backgroundColor: tone.card,
        justifyContent: "space-between",
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: tone.text }}>{title}</Text>
      {children}
    </View>
  );
}

function Locked({ label, tone }: { label: string; tone: ReturnType<typeof useRoomTone> }) {
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tone.line,
        opacity: 0.7,
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: tone.muted }}>{label}</Text>
    </View>
  );
}
