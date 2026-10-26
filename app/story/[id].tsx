import { SaveExperience } from "@/components/tracking/SaveExperience";
import { AttachedEvidence } from "@/components/tracking/AttachedEvidence";
import {
  ExperienceAttachment,
  AttachedExperienceLink,
} from "@/components/unmask-ui/ExperienceAttachment";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ActionButton,
  AppShell,
  Avatar,
  MediaFrame,
  StatusMessage,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import * as community from "@/lib/community-v2/api";
import { SAMPLE_REPLIES, sampleById } from "@/lib/unmask/samples";
import { relativeTime } from "@/lib/unmask/time";
import { useAppStore } from "@/lib/store";

export default function Story() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const sample = sampleById(id);
  const [attachedJourney, setAttachedJourney] = useState("");
  const [attachment, setAttachment] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const story = useQuery({
    queryKey: ["clarity-experience", id],
    queryFn: () => community.experience(id),
    enabled: !!id && !sample,
  });
  const replies = useQuery({
    queryKey: ["experience-replies", id],
    queryFn: () => community.entries(id, "replies"),
    enabled: !!id && !sample,
  });
  const updates = useQuery({
    queryKey: ["experience-followups", id],
    queryFn: () => community.entries(id, "followups"),
    enabled: !!id && !sample,
  });
  const send = async () => {
    if (!uid) {
      router.push("/(auth)/sign-in" as Href);
      return;
    }
    if (sample) return;
    setPending(true);
    setError("");
    try {
      await community.addEntry(
        id,
        reply.trim(),
        "replies",
        "",
        "",
        "",
        attachment || undefined,
        attachedJourney || undefined,
      );
      setReply("");
      setAttachment("");
      setAttachedJourney("");
      await qc.invalidateQueries({ queryKey: ["experience-replies", id] });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Reply didn’t send. Your text is still here.",
      );
    } finally {
      setPending(false);
    }
  };

  if (sample) {
    const thread = SAMPLE_REPLIES[sample.id] ?? [];
    return (
      <AppShell back navigation title={sample.productName || "Story"}>
        {sample.sample ? (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: colors.inkSoft,
            }}
          >
            Design sample · not a live member post.
          </Text>
        ) : null}
        <MediaFrame
          uri={sample.photo || sample.productImage}
          label={sample.productName || sample.title}
          overlay
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={sample.author} uri={sample.creatorAvatar} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 15,
                color: colors.ink,
              }}
            >
              {sample.author}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13,
                color: colors.inkSoft,
              }}
            >
              {relativeTime(sample.createdAt)}
              {sample.chips[0] ? `  ·  ${sample.chips[0]}` : ""}
            </Text>
          </View>
        </View>
        <Text
          style={{
            fontFamily: fonts.serifBold,
            fontSize: 26,
            lineHeight: 30,
            color: colors.ink,
            letterSpacing: -0.4,
          }}
        >
          {sample.title}
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 17,
            lineHeight: 26,
            color: colors.ink,
          }}
        >
          {sample.body}
        </Text>
        <ActionButton
          label={COPY.takeFurther}
          tone="secondary"
          onPress={() => router.push("/investigation/sample-unmask-1" as Href)}
        />
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 14,
            lineHeight: 20,
            color: colors.inkSoft,
          }}
        >
          {COPY.supportPrompt}
        </Text>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            letterSpacing: 0.5,
            color: colors.inkSoft,
          }}
        >
          REPLIES
        </Text>
        {thread.map((r) => (
          <View
            key={r.id}
            style={{ flexDirection: "row", gap: 12, paddingVertical: 4 }}
          >
            <Avatar name={r.author} uri={r.avatar} size={32} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                  color: colors.ink,
                }}
              >
                {r.author}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.ink,
                }}
              >
                {r.body}
              </Text>
            </View>
          </View>
        ))}
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder="Share what you know. You can attach your product experience."
          placeholderTextColor={colors.bone3}
          multiline
          style={{
            fontFamily: fonts.regular,
            fontSize: 16,
            minHeight: 72,
            color: colors.ink,
            backgroundColor: colors.mist,
            borderRadius: 16,
            padding: 14,
          }}
        />
        <ActionButton
          label="Sign in to reply"
          onPress={() => router.push("/(auth)/sign-in" as Href)}
        />
      </AppShell>
    );
  }

  if (story.isError) {
    return (
      <AppShell back navigation title="Story">
        <StatusMessage
          kind="error"
          title="This story isn’t available."
          detail="It may be private or still loading."
        />
      </AppShell>
    );
  }

  const e = story.data;
  return (
    <AppShell back navigation title={e?.unmask_catalog?.name || "Story"}>
      {e ? (
        <>
          <MediaFrame
            uri={e.photo_path || e.unmask_catalog?.image_url}
            experiencePath={e.photo_path}
            label={e.unmask_catalog?.name || "Story"}
            overlay
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={e.author_name} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 15,
                  color: colors.ink,
                }}
              >
                {e.author_name}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: colors.inkSoft,
                }}
              >
                {relativeTime(e.created_at)}
                {e.duration ? `  ·  ${e.duration}` : ""}
                {e.skin_type ? `  ·  ${e.skin_type}` : ""}
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 17,
              lineHeight: 26,
              color: colors.ink,
            }}
          >
            {e.body}
          </Text>
          <SaveExperience id={e.id} />
          <AttachedEvidence
            journeyId={e.attached_journey_id}
            experienceId={e.attached_experience_id}
          />
          <ActionButton
            label={COPY.takeFurther}
            tone="secondary"
            onPress={() =>
              router.push(
                `/investigation/request?experience=${e.id}&product=${e.product_id}` as Href,
              )
            }
          />
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 14,
              lineHeight: 20,
              color: colors.inkSoft,
            }}
          >
            {COPY.supportPrompt}
          </Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 13,
              letterSpacing: 0.5,
              color: colors.inkSoft,
            }}
          >
            REPLIES
          </Text>
          {(replies.data ?? []).map((r) => (
            <View
              key={r.id}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 4 }}
            >
              <Avatar name={r.author_name || "Member"} size={32} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 14,
                    color: colors.ink,
                  }}
                >
                  {r.author_name || "Member"}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 16,
                    lineHeight: 24,
                    color: colors.ink,
                  }}
                >
                  {r.body}
                </Text>
                <AttachedExperienceLink
                  id={r.attached_experience_id}
                  journeyId={r.attached_journey_id}
                />
              </View>
            </View>
          ))}
          {(updates.data ?? []).length ? (
            <>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  letterSpacing: 0.5,
                  color: colors.inkSoft,
                }}
              >
                UPDATES
              </Text>
              {updates.data!.map((u) => (
                <Text
                  key={u.id}
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 16,
                    lineHeight: 24,
                    color: colors.ink,
                  }}
                >
                  {u.body}
                </Text>
              ))}
            </>
          ) : null}
          <ExperienceAttachment
            productId={e.product_id}
            value={attachment}
            onChange={setAttachment}
            journeyValue={attachedJourney}
            onJourneyChange={setAttachedJourney}
          />
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Share what you know. You can attach your product experience."
            placeholderTextColor={colors.bone3}
            multiline
            style={{
              fontFamily: fonts.regular,
              fontSize: 16,
              minHeight: 72,
              color: colors.ink,
              backgroundColor: colors.mist,
              borderRadius: 16,
              padding: 14,
            }}
          />
          {error ? (
            <StatusMessage
              kind="error"
              title="Reply didn’t send."
              detail={error}
            />
          ) : null}
          <ActionButton
            label="Post reply"
            pending={pending}
            disabled={!reply.trim()}
            onPress={() => void send()}
          />
        </>
      ) : (
        <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
          Loading story…
        </Text>
      )}
    </AppShell>
  );
}
