import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { ChatCircle, CaretRight } from "@/components/icons";
import { ActionButton, ContentSkeleton, SearchField } from "@/components/unmask-ui";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { fetchFeed } from "@/lib/community";
import { useRoomTone } from "@/lib/social/roomTone";
import { SAMPLE_FEED } from "@/lib/unmask/samples";
import { feedForRelease } from "@/lib/unmask/publicFeed";

export function CommunityQuestionsFeed() {
  const tone = useRoomTone();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const feed = useQuery({
    queryKey: ["community-questions", search],
    queryFn: () => fetchFeed({ kind: "question", q: search || undefined, limit: 24 }),
    staleTime: 45_000,
  });

  type Row = { id: string; title: string; body: string; replies: number; views: number };

  const fallback: Row[] = feedForRelease(SAMPLE_FEED)
    .filter((x) => x.kind === "question")
    .map((x) => ({
      id: x.id,
      title: x.title,
      body: x.body,
      replies: 12,
      views: 340,
    }));

  const rows: Row[] = feed.data?.length
    ? feed.data.map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body ?? "",
        replies: t.reply_count,
        views: Math.max(40, t.reply_count * 28 + (t.votes ?? 0) * 6),
      }))
    : fallback;

  return (
    <View style={{ gap: 16, paddingBottom: 32 }}>
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search a product or question"
      />
      {feed.isLoading ? <ContentSkeleton rows={4} /> : null}

      {rows.map((row) => {
        const href = `/question/${row.id}` as Href;
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            onPress={() => {
              hapticSelect();
              router.push(href);
            }}
            style={{
              marginHorizontal: 16,
              padding: 16,
              borderRadius: livelyRadii.card,
              backgroundColor: tone.card,
              borderWidth: 1,
              borderColor: tone.line,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ChatCircle size={18} color={tone.gold} weight="fill" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: tone.text, flex: 1 }}>
                {row.title}
              </Text>
              <CaretRight size={16} color={tone.muted} />
            </View>
            {row.body ? (
              <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: tone.muted }}>
                {row.body}
              </Text>
            ) : null}
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: tone.faint }}>
              {row.replies} replies · {row.views} views
            </Text>
          </Pressable>
        );
      })}

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <ActionButton
          label="Ask a question"
          onPress={() => router.push("/ask-community" as Href)}
        />
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: tone.muted, textAlign: "center", marginTop: 10 }}>
          Pick a product first — then ask people who actually tried it.
        </Text>
      </View>
    </View>
  );
}