import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { GlassCard } from "@/components/lively";
import { ActionButton, SearchField, StatusMessage } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { first90 } from "@/lib/movement/first90";
import * as living from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import { useScan } from "@/lib/useScan";

import { CommunityPulse } from "./CommunityPulse";
import { useMovementPalette } from "../movement/palette";

export function SocialHome() {
  const palette = useMovementPalette();
  const router = useRouter();
  const scan = useScan();
  const profile = useAppStore((state) => state.profile);
  const uid = profile?.id;
  const name = (profile?.displayName || "Unmasker").split(" ")[0];
  const [query, setQuery] = useState("");
  const movement = first90();
  const timelines = useQuery({
    queryKey: ["living", "journeys", uid],
    queryFn: living.journeys,
    enabled: !!uid,
  });
  const search = () => {
    const q = query.trim();
    if (q.length > 1) router.push({ pathname: "/results", params: { q } } as Href);
  };
  const dayLine =
    movement.status === "complete"
      ? "Day 90 complete"
      : movement.status === "before"
        ? movement.line
        : `Day ${movement.day} · ${movement.phase}`;

  return (
    <View style={{ gap: 20, paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 20, gap: 6 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.4, color: palette.gold }}>{dayLine.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, color: palette.ink }}>
          Hey {name} — show what you’re using.
        </Text>
      </View>

      <CommunityPulse showCta />

      <View style={{ paddingHorizontal: 20 }}>
        <GlassCard>
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: palette.ink }}>Search a product</Text>
            <SearchField value={query} onChange={setQuery} onSubmit={search} onCamera={scan.openCamera} placeholder="What’s on your shelf?" />
            {query.trim().length > 1 ? <ActionButton label="Search" onPress={search} /> : null}
          </View>
        </GlassCard>
      </View>

      {typeof timelines.data?.length === "number" && timelines.data.length > 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ActionButton tone="secondary" label={`My timelines (${timelines.data.length})`} onPress={() => router.push("/products" as Href)} />
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          <ActionButton tone="ghost" label="Start a product timeline" onPress={() => router.push("/products/add" as Href)} />
        </View>
      )}

      {timelines.isError ? (
        <View style={{ paddingHorizontal: 20 }}>
          <StatusMessage kind="error" title="Timelines couldn’t load." detail="Posts and search still work." />
        </View>
      ) : null}
      {scan.sheet}
    </View>
  );
}
