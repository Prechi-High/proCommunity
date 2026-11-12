import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { loadHomeFeed, type FeedItem } from "@/lib/unmask/feed";
import { SAMPLE_FEED } from "@/lib/unmask/samples";

import { useMovementPalette } from "./palette";

function presence(items: FeedItem[]) {
  return items.filter((item) => item.kind === "experience" || item.kind === "question");
}

function distinctAuthors(items: FeedItem[], limit: number) {
  const seen = new Set<string>();
  const rows: FeedItem[] = [];
  for (const item of items) {
    const key = item.author.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(item);
    if (rows.length >= limit) break;
  }
  return rows;
}

function Face({ item, size = 36 }: { item: FeedItem; size?: number }) {
  const palette = useMovementPalette();
  const uri = item.creatorAvatar;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.quiet }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.quiet, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: palette.ink }}>{item.author.slice(0, 1)}</Text>
    </View>
  );
}

export function CommunityWithUs() {
  const palette = useMovementPalette();
  const router = useRouter();
  const live = useQuery({
    queryKey: ["movement-community"],
    queryFn: loadHomeFeed,
    staleTime: 60_000,
    retry: 1,
  });
  const realPeople = distinctAuthors(presence(live.data ?? []), 4);
  const fillers = distinctAuthors(presence(SAMPLE_FEED), 4).filter(
    (item) => !realPeople.some((real) => real.author.toLowerCase() === item.author.toLowerCase()),
  );
  const people = [...realPeople, ...fillers].slice(0, 4);
  const names = realPeople.map((item) => item.author);
  const named = names.slice(0, 3).join(", ");
  const usingSamples = people.some((item) => item.sample);
  if (!people.length && live.isLoading) return null;
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.6, color: palette.gold }}>
        WITH OTHER UNMASKERS
      </Text>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.4, color: palette.ink }}>
        You are not doing this alone.
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flexDirection: "row" }}>
          {people.slice(0, 4).map((item, index) => (
            <View key={item.id} style={{ marginLeft: index ? -10 : 0, borderWidth: 2, borderColor: palette.page, borderRadius: 20 }}>
              <Face item={item} />
            </View>
          ))}
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: palette.ink }}>
          {names.length
            ? `${named} ${names.length > 1 ? "are" : "is"} already sharing on Unmask.`
            : "Unmaskers are already documenting what they use."}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
        {people.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="link"
            accessibilityLabel={`${item.author} on ${item.productName || "a product"}. ${item.title}`}
            onPress={() => {
              hapticSelect();
              router.push((item.sample ? "/community" : item.href) as Href);
            }}
            style={({ pressed }) => ({
              width: 250,
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: pressed ? palette.quiet : palette.card,
            })}
          >
            {item.productImage || item.photo ? (
              <Image
                source={{ uri: item.photo || item.productImage || "" }}
                accessibilityIgnoresInvertColors
                style={{ width: "100%", height: 140, backgroundColor: palette.quiet }}
                resizeMode="cover"
              />
            ) : null}
            <View style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Face item={item} size={28} />
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }} numberOfLines={1}>
                  {item.author}
                </Text>
                {item.sample ? (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.4, color: palette.gold }}>SAMPLE</Text>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: palette.ink }} numberOfLines={3}>
                {item.title}
              </Text>
              {item.productName ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: palette.muted }} numberOfLines={1}>
                  {item.productName}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {usingSamples ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: palette.muted }}>
          Cards marked Sample are examples of how people show up together. They are not real reviews.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          hapticSelect();
          router.push("/community" as Href);
        }}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.wine }}>See the community</Text>
      </Pressable>
    </View>
  );
}
