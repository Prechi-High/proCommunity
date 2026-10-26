import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { EvidencePicker } from "@/components/tracking/EvidencePicker";
import { AttachedEvidence } from "@/components/tracking/AttachedEvidence";
import type { EvidenceSelection } from "@/lib/tracking/api";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import type { FeedItem } from "@/lib/unmask/feed";
import { SAMPLE_REPLIES } from "@/lib/unmask/samples";
import * as social from "@/lib/unmask/social";
import * as community from "@/lib/community-v2/api";
import * as living from "@/lib/living/api";
import { ActionSheet } from "./ActionSheet";
import { ActionButton } from "./ActionButton";
import { Avatar } from "./Avatar";
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
  const uid = useAppStore((s) => s.profile?.id);
  const router = useRouter();
  const qc = useQueryClient();
  const [attachment, setAttachment] = useState<EvidenceSelection | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        author: r.author_name || "Unmasker",
        body: r.body,
        attached_experience_id: r.attached_experience_id,
        attached_journey_id: r.attached_journey_id,
      }));
    },
  });
  const rows = item.sample ? (SAMPLE_REPLIES[item.id] ?? []) : (q.data ?? []);
  async function submit() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (item.kind === "unmask")
        await social.addUnmaskComment(id, body, {
          journey: attachment?.kind === "journey" ? attachment.id : undefined,
          experience:
            attachment?.kind === "experience" ? attachment.id : undefined,
        });
      else if (item.kind === "experience")
        await community.addEntry(
          id,
          body,
          "replies",
          "",
          "",
          "",
          attachment?.kind === "experience" ? attachment.id : undefined,
          attachment?.kind === "journey" ? attachment.id : undefined,
        );
      else
        await living.addAnswer({
          question_id: id,
          attached_experience_id:
            attachment?.kind === "experience" ? attachment.id : null,
          attached_journey_id:
            attachment?.kind === "journey" ? attachment.id : null,
          body,
          duration: "",
          context: "",
          acquisition: "",
          uncertainty: "",
        });
      setBody("");
      setAttachment(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: key }),
        qc.invalidateQueries({ queryKey: ["post-stats"] }),
      ]);
    } catch {
      setError("Your comment couldn’t be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }
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
      {q.isError && !item.sample ? (
        <ActionButton
          tone="secondary"
          label="Retry comments"
          onPress={() => void q.refetch()}
        />
      ) : null}
      {!item.sample && q.isLoading ? <ContentSkeleton /> : null}
      {rows.map((row) => (
        <View
          key={row.id}
          style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}
        >
          <Avatar name={row.author} size={34} />
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
            <AttachedEvidence
              journeyId={
                "attached_journey_id" in row
                  ? (row.attached_journey_id as string)
                  : undefined
              }
              experienceId={
                "attached_experience_id" in row
                  ? (row.attached_experience_id as string)
                  : undefined
              }
            />
          </View>
        </View>
      ))}
      {!rows.length && !q.isLoading && !q.isError ? (
        <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
          Be the first to add something helpful.
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
      {!item.sample ? (
        uid ? (
          <>
            <EvidencePicker value={attachment} onChange={setAttachment} />
            <TextInput
              accessibilityLabel="Write a comment"
              placeholder="Add to the conversation…"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: "#DDD3CF",
                borderRadius: 16,
                minHeight: 80,
                color: colors.ink,
              }}
            />
            <ActionButton
              label="Post comment"
              pending={busy}
              disabled={!body.trim() || busy}
              onPress={() => void submit()}
            />
          </>
        ) : (
          <ActionButton
            label="Sign in to join in"
            onPress={() => {
              onClose();
              router.push({
                pathname: "/(auth)/sign-in",
                params: { returnTo: item.href },
              } as Href);
            }}
          />
        )
      ) : null}
      {error ? <StatusMessage kind="error" title={error} /> : null}
    </ActionSheet>
  );
}
