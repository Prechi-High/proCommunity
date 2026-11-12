import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { StoryRail } from "@/components/lively";
import { ActionButton } from "@/components/unmask-ui";
import { colors, fonts } from "@/constants/theme";
import { features } from "@/lib/features";
import { loadHomeFeed } from "@/lib/unmask/feed";
import { feedForRelease } from "@/lib/unmask/publicFeed";
import { SAMPLE_FEED } from "@/lib/unmask/samples";

import { VisualPostCard } from "./VisualPostCard";

export function CommunityPulse({
  showCta = true,
  demoFallback = true,
}: {
  showCta?: boolean;
  demoFallback?: boolean;
}) {
  const router = useRouter();
  const feed = useQuery({
    queryKey: ["home-feed", "pulse"],
    queryFn: loadHomeFeed,
    staleTime: 45_000,
  });
  let rows = feedForRelease(feed.data ?? []);
  if (!rows.length && demoFallback) {
    rows = feedForRelease(SAMPLE_FEED).filter((x) => x.kind !== "question");
  }
  const featured = rows.find((x) => x.kind === "experience") ?? rows[0];
  const rest = rows.filter((x) => x.id !== featured?.id).slice(0, 8);

  return (
    <View style={{ gap: 22 }}>
      <StoryRail />
      {featured ? (
        <View style={{ paddingHorizontal: 20 }}>
          <VisualPostCard item={featured} variant="featured" />
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink, paddingHorizontal: 20 }}>
          From the community
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
        >
          {rest.map((item) => (
            <VisualPostCard key={item.id} item={item} />
          ))}
        </ScrollView>
      </View>
      {showCta ? (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <ActionButton
            label="Share your moment"
            onPress={() => router.push("/moment" as Href)}
          />
          <ActionButton
            tone="secondary"
            label="Open full community feed"
            onPress={() => router.push("/community" as Href)}
          />
          {!features.ultraUnmask ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.inkSoft, textAlign: "center" }}>
              Post a photo or clip first. Add My Unmask or a product timeline when you want — not required.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
