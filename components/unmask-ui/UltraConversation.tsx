import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { ReplyComposer } from "@/components/community/ReplyComposer";
import { EvidencePicker } from "@/components/tracking/EvidencePicker";
import { AttachedEvidence } from "@/components/tracking/AttachedEvidence";
import type { EvidenceSelection } from "@/lib/tracking/api";
import { useAppStore } from "@/lib/store";
import * as social from "@/lib/unmask/social";
import { PersonAvatar } from "./PersonAvatar";
import { ActionButton } from "./ActionButton";
import { ContentSkeleton } from "./Skeleton";
import { StatusMessage } from "./StatusMessage";
import { colors, fonts } from "@/constants/theme";
export function UltraConversation({ id }: { id: string }) {
  const r = useRouter(),
    qc = useQueryClient(),
    profile = useAppStore((s) => s.profile);
  const [body, setBody] = useState(""),
    [attachment, setAttachment] = useState<EvidenceSelection | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const replies = useQuery({
    queryKey: ["post-comments", "unmask", id],
    queryFn: () => social.unmaskComments(id),
  });
  async function send() {
    if (!body.trim() || pending) return;
    setPending(true);
    setError("");
    try {
      await social.addUnmaskComment(id, body, {
        journey: attachment?.kind === "journey" ? attachment.id : undefined,
        experience:
          attachment?.kind === "experience" ? attachment.id : undefined,
      });
      setBody("");
      setAttachment(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["post-comments", "unmask", id] }),
        qc.invalidateQueries({ queryKey: ["post-stats", "unmask", id] }),
      ]);
    } catch {
      setError("Your reply couldn’t be sent. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <View style={{ gap: 18 }}>
      <Text
        style={{ fontFamily: fonts.semibold, fontSize: 22, color: colors.ink }}
      >
        The conversation
      </Text>
      {replies.isLoading ? (
        <ContentSkeleton />
      ) : replies.isError ? (
        <StatusMessage kind="error" title="Replies couldn’t load" />
      ) : !replies.data?.length ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            lineHeight: 23,
            color: colors.inkSoft,
          }}
        >
          No replies yet. What could help the community understand this story?
        </Text>
      ) : (
        replies.data.map((row) => (
          <View key={row.id} style={{ flexDirection: "row", gap: 12 }}>
            <PersonAvatar id={row.user_id} name={row.author_name} size={32} />
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>
                {row.author_name}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.ink,
                }}
              >
                {row.body}
              </Text>
              <AttachedEvidence
                attachedBy={row.author_name}
                journeyId={row.attached_journey_id}
                experienceId={row.attached_experience_id}
              />
            </View>
          </View>
        ))
      )}
      {profile ? (
        <ReplyComposer
          name={profile.displayName || "You"}
          body={body}
          onChange={setBody}
          onSend={() => void send()}
          pending={pending}
          hasAttachment={!!attachment}
          attachment={
            <EvidencePicker value={attachment} onChange={setAttachment} />
          }
        />
      ) : (
        <ActionButton
          label="Sign in to reply"
          onPress={() =>
            r.push({
              pathname: "/(auth)/sign-in",
              params: { returnTo: `/investigation/${id}` },
            } as Href)
          }
        />
      )}
      {error ? <StatusMessage kind="error" title={error} /> : null}
    </View>
  );
}
