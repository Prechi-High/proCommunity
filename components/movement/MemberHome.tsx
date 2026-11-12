import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { ArrowRight } from "@/components/icons";
import { ActionButton, SearchField, StatusMessage } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { daysBetween, first90, lagosISO } from "@/lib/movement/first90";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { useScan } from "@/lib/useScan";

import { GlassCard } from "@/components/lively";

import { useMovementPalette } from "./palette";

export function MemberHome() {
  const palette = useMovementPalette();
  const router = useRouter();
  const scan = useScan();
  const profile = useAppStore((state) => state.profile);
  const uid = profile?.id;
  const name = (profile?.displayName || "Unmasker").split(" ")[0];
  const [query, setQuery] = useState("");
  const movement = first90();
  const joined = useQuery({
    queryKey: ["account-opened", uid],
    enabled: !!uid && !!supabase,
    queryFn: async () => {
      const { data } = await supabase!.auth.getSession();
      return data.session?.user.created_at ?? null;
    },
  });
  const timelines = useQuery({
    queryKey: ["living", "journeys", uid],
    queryFn: living.journeys,
    enabled: !!uid,
  });
  const opened = joined.data ? lagosISO(new Date(joined.data)) : "";
  const days = opened ? daysBetween(movement.today, opened) : null;
  const count = timelines.data?.length;
  const search = () => {
    const q = query.trim();
    if (q.length > 1) router.push({ pathname: "/results", params: { q } } as Href);
  };
  const dayLine =
    movement.status === "complete"
      ? "The First 90 is complete. The next layer is opening."
      : movement.status === "before"
        ? movement.line
        : `Day ${movement.day} of 90 · ${movement.phase}`;

  return (
    <View style={{ gap: 22, paddingTop: 8 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 2.2, color: palette.gold }}>{dayLine.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.4, color: palette.ink }}>
          {name}, you are an Unmasker.
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: palette.muted }}>{movement.line}</Text>
      </View>

      {days !== null ? (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: palette.ink }}>
          {days <= 0 ? "You started Unmasking today." : `You have been Unmasking for ${days} ${days === 1 ? "day" : "days"}.`}
        </Text>
      ) : null}
      {typeof count === "number" && count > 0 ? (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: palette.ink }}>
          Your product timeline is growing. {count} {count === 1 ? "timeline" : "timelines"} on your shelf.
        </Text>
      ) : null}
      {timelines.isError ? <StatusMessage kind="error" title="Your timelines couldn’t load." detail="Search and the community are still open." /> : null}

      <GlassCard>
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, color: palette.ink }}>Start with one product.</Text>
          <SearchField value={query} onChange={setQuery} onSubmit={search} onCamera={scan.openCamera} placeholder="Which product are you using?" />
          {query.trim().length > 1 ? <ActionButton label="Search products" onPress={search} /> : null}
        </View>
      </GlassCard>
      {scan.sheet}

      {count === 0 ? (
        <ActionButton label="Start with one product" onPress={() => router.push("/products/add" as Href)} />
      ) : count ? (
        <ActionButton tone="secondary" label="Open my timelines" onPress={() => router.push("/products" as Href)} />
      ) : null}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Community. Read experiences and ask before you buy."
        onPress={() => {
          hapticSelect();
          router.navigate("/community" as Href);
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        <GlassCard>
          <View style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: palette.ink }}>Community</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted }}>
                See what other Unmaskers have shared. Ask before you buy.
              </Text>
            </View>
            <ArrowRight size={20} color={palette.wine} />
          </View>
        </GlassCard>
      </Pressable>

      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: palette.muted }}>The next layer is coming.</Text>
    </View>
  );
}
