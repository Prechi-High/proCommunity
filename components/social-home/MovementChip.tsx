import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Play } from "@/components/icons";
import { useMovementPalette } from "@/components/movement/palette";
import { OrientationFilm } from "@/components/movement/OrientationFilm";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { daysBetween, first90, lagosISO } from "@/lib/movement/first90";
import { publicPhaseLabel } from "@/lib/social/model";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";

export function MovementChip() {
  const palette = useMovementPalette();
  const [film, setFilm] = useState(false);
  const movement = first90();
  const uid = useAppStore((state) => state.profile?.id);
  const joined = useQuery({
    queryKey: ["account-opened", uid],
    enabled: !!uid && !!supabase,
    queryFn: async () => {
      const { data } = await supabase!.auth.getSession();
      return data.session?.user.created_at ?? null;
    },
  });
  const opened = joined.data ? lagosISO(new Date(joined.data)) : "";
  const days = opened ? daysBetween(movement.today, opened) : null;
  const phase = publicPhaseLabel(movement.phase);
  const day =
    movement.status === "before"
      ? "Soon"
      : movement.status === "complete"
        ? "Day 90/90"
        : `Day ${movement.day}/90`;
  const yours =
    days === null ? "" : days <= 0 ? "You started Unmasking today." : `You have been Unmasking for ${days} ${days === 1 ? "day" : "days"}.`;
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${day}. ${phase}. ${movement.line} Film.`}
        onPress={() => {
          hapticSelect();
          setFilm((open) => !open);
        }}
        style={{
          minHeight: 64,
          borderRadius: 22,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.line,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.6, color: palette.gold }}>
            {day.toUpperCase()} · {phase.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.ink }}>
            {yours || movement.line}
          </Text>
        </View>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.quiet, alignItems: "center", justifyContent: "center" }}>
          <Play size={16} color={palette.wine} weight="fill" />
        </View>
      </Pressable>
      {film ? <OrientationFilm /> : null}
    </View>
  );
}
