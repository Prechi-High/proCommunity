import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Lock } from "@/components/icons";
import { OrientationFilm } from "@/components/movement/OrientationFilm";
import { fonts } from "@/constants/theme";
import { first90 } from "@/lib/movement/first90";
import { hapticSelect } from "@/lib/haptics";
import { useRoomTone } from "@/lib/social/roomTone";

export function UnmaskTeasers() {
  const tone = useRoomTone();
  const router = useRouter();
  const movement = first90();
  const day =
    movement.status === "during"
      ? `Day ${movement.day} of 90`
      : movement.status === "complete"
        ? "After the 90"
        : "Before Day 1";
  const [film, setFilm] = useState(false);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.4, color: tone.faint, paddingHorizontal: 16 }}>
        {day} · later layers stay closed
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <Slip locked kicker="Ask" title="Ask the brand" line="After the First 90" tone={tone} />
        <Slip locked kicker="Ask" title="Ask an expert" line="After the First 90" tone={tone} />
        <Slip locked kicker="Sellers" title="Audio room" line="Not open in this stretch" tone={tone} />
        <Slip
          kicker="Store"
          title="Create your store"
          line="Open now"
          tone={tone}
          onPress={() => {
            hapticSelect();
            router.push("/offers" as Href);
          }}
        />
        <Slip
          kicker="Film"
          title="What Unmask is"
          line={film ? "Hide" : "Play"}
          tone={tone}
          onPress={() => {
            hapticSelect();
            setFilm((v) => !v);
          }}
        />
      </ScrollView>
      {film ? (
        <View style={{ paddingHorizontal: 16 }}>
          <OrientationFilm />
        </View>
      ) : null}
    </View>
  );
}

function Slip({
  locked,
  kicker,
  title,
  line,
  onPress,
  tone,
}: {
  locked?: boolean;
  kicker: string;
  title: string;
  line: string;
  onPress?: () => void;
  tone: ReturnType<typeof useRoomTone>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!locked }}
      disabled={!!locked}
      onPress={onPress}
      style={{
        width: 168,
        height: 72,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        justifyContent: "center",
        gap: 2,
        borderWidth: 1,
        borderStyle: locked ? "dashed" : "solid",
        borderColor: locked ? tone.line : tone.gold,
        backgroundColor: locked ? "transparent" : "rgba(201,162,39,0.1)",
        opacity: locked ? 0.62 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {locked ? <Lock size={11} color={tone.faint} /> : null}
        <Text style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.8, color: tone.faint }}>{kicker.toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: tone.text }}>{title}</Text>
      <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: tone.muted }}>{line}</Text>
    </Pressable>
  );
}
