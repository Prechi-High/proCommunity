import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { AttachedEvidence } from "@/components/tracking/AttachedEvidence";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { colors, fonts } from "@/constants/theme";
import type { FeedItem } from "@/lib/unmask/feed";
import { SAMPLE_REPLIES } from "@/lib/unmask/samples";
import * as social from "@/lib/unmask/social";
import * as community from "@/lib/community-v2/api";
import * as living from "@/lib/living/api";
import { ActionSheet } from "./ActionSheet";
import { ActionButton } from "./ActionButton";
import { PersonAvatar } from "./PersonAvatar";
import { StatusMessage } from "./StatusMessage";
export function PostComments({
  item,
  open,
  onClose,
}: {
  item: FeedItem;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const id = social.postId(item.href);
  const key = ["post-comments", item.kind, id];
  const q = useQuery({
    queryKey: key,
    enabled: open && !item.sample,
    queryFn: async () => {
      const rows =
        item.kind === "unmask"
          ? await social.unmaskComments(id)
          : item.kind === "experience"
            ? await community.entries(id, "replies")
            : await living.answers(id);
      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        author: r.author_name || "Unmasker",
        body: r.body,
        attached_experience_id: r.attached_experience_id,
        attached_journey_id: r.attached_journey_id,
      }));
    },
  });
  const rows = item.sample ? (SAMPLE_REPLIES[item.id] ?? []) : (q.data ?? []);
  return (
    <ActionSheet open={open} onClose={onClose} title="The conversation">
      <Text
        style={{
          fontFamily: fonts.medium,
          color: colors.inkSoft,
          fontSize: 13,
        }}
      >
        {item.title}
      </Text>
      {item.sample ? (
        <StatusMessage
          title="Demo conversation"
          detail="These replies are fictional. Posting is available on real stories."
        />
      ) : null}
      {q.isError && !item.sample ? <StatusMessage kind="error" title="Replies couldn’t load here. Open the conversation to try again." /> : null}
      {!item.sample && q.isLoading ? <ContentSkeleton /> : null}
      {rows.slice(0,3).map((row) => (
        <View
          key={row.id}
          style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}
        >
          <PersonAvatar id={"user_id" in row ? row.user_id as string : undefined} name={row.author} size={34} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 14,
                color: colors.ink,
              }}
            >
              {row.author}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 15,
                lineHeight: 22,
                color: colors.ink,
              }}
            >
              {row.body}
            </Text>
          </View>
        </View>
      ))}
      {!rows.length && !q.isLoading && !q.isError ? (
        <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
          No replies yet. Join the conversation to add your voice.
        </Text>
      ) : null}
      <ActionButton
        tone="secondary"
        label="Join conversation"
        onPress={() => {
          onClose();
          router.push(item.href as Href);
        }}
      />
    </ActionSheet>
  );
}
