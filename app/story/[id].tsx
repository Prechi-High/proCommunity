import { TakeFurtherCard } from "@/components/unmask-ui/TakeFurtherCard";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { ReplyComposer } from "@/components/community/ReplyComposer";
import { ProductIdentity } from "@/components/community/ProductIdentity";
import { ChatCircle } from "@/components/icons";
import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { SaveExperience } from "@/components/tracking/SaveExperience";
import { AttachedEvidence } from "@/components/tracking/AttachedEvidence";
import {
  ExperienceAttachment,
  AttachedExperienceLink,
} from "@/components/unmask-ui/ExperienceAttachment";
import { useState } from "react";
import { Text, View } from "react-native";
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
  const profile = useAppStore((s) => s.profile);
  const uid = profile?.id;
  const [addDetail, setAddDetail] = useState(false);
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
    if (sample || pending || !reply.trim()) return;
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
      <AppShell back navigation title="Product Experience" subtitle={`Shared by ${sample.author}`}>
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
        <ProductIdentity name={sample.productName || "Product"} image={sample.productImage} />
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 20,
            lineHeight: 26,
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
        <ActionButton
          label="Sign in to reply"
          onPress={() => router.push("/(auth)/sign-in" as Href)}
        />
      </AppShell>
    );
  }

  if (story.isError) {
    return (
      <AppShell back navigation title="Product Experience">
        <StatusMessage
          kind="error"
          title="This experience isn’t available."
          detail="It may be private or still loading."
        />
      </AppShell>
    );
  }

  const e = story.data;
  return (
    <AppShell back navigation title="Product Experience">
      {e ? <View style={{flexDirection:"row",gap:10,alignItems:"center"}}><PersonAvatar id={e.user_id} name={e.author_name} size={36}/><Text style={{fontFamily:fonts.semibold,color:colors.ink}}>{e.author_name}</Text></View> : null}
      {e ? (
        <>
          <ProductIdentity
            name={e.unmask_catalog?.name || "Product"}
            brand={e.unmask_catalog?.brand}
            image={e.unmask_catalog?.image_url}
          />
          {e.skin_type ? <StatusMessage title={`${e.skin_type} skin`} detail="Context shared by the person posting." /> : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
            {[relativeTime(e.created_at), e.usage_status, e.duration, e.frequency].filter(Boolean).join(" · ")}
          </Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 20,
              lineHeight: 26,
              color: colors.ink,
            }}
          >
            {e.body}
          </Text>
          {e.photo_path ? <MediaFrame experiencePath={e.photo_path} label="Photo shared with this experience" /> : null}
          <SaveExperience id={e.id} />
          <AttachedEvidence
            attachedBy={e.author_name}
            journeyId={e.attached_journey_id}
            experienceId={e.attached_experience_id}
          />
          {replies.isLoading ? <ContentSkeleton rows={2} /> : null}
          {replies.isError ? <StatusMessage kind="error" title="Replies couldn’t load" detail="Try opening this conversation again." /> : null}
          {replies.isSuccess && !replies.data.length ? (
            <View style={{ paddingVertical: 34, alignItems: "center", gap: 10 }}>
              <ChatCircle size={32} color={colors.inkSoft} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}>No replies yet</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft, textAlign: "center" }}>
                {e.user_id === uid ? "Your experience is out there. We’ll let you know when someone replies." : "Tried this product? Join the conversation."}
              </Text>
            </View>
          ) : null}
          {(replies.data ?? []).map((r) => (
            <View
              key={r.id}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 4 }}
            >
              <PersonAvatar id={r.user_id} name={r.author_name || "Member"} size={32} />
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
                  attachedBy={r.author_name}
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
          {e.user_id !== uid || addDetail ? (
            <ReplyComposer
              name={profile?.displayName || "You"}
              body={reply}
              onChange={setReply}
              onSend={() => void send()}
              pending={pending}
              hasAttachment={!!(attachment || attachedJourney)}
              attachment={
                <ExperienceAttachment
                  productId={e.product_id}
                  value={attachment}
                  onChange={setAttachment}
                  journeyValue={attachedJourney}
                  onJourneyChange={setAttachedJourney}
                />
              }
            />
          ) : (
            <ActionButton tone="ghost" label="Add more context to my experience" onPress={() => setAddDetail(true)} />
          )}
          {error ? (
            <StatusMessage
              kind="error"
              title="Reply didn’t send."
              detail={error}
            />
          ) : null}
          <TakeFurtherCard
            onPress={() =>
              router.push(
                `/investigation/request?experience=${e.id}&product=${e.product_id}` as Href,
              )
            }
          />

        </>
      ) : (
        <ContentSkeleton />
      )}
    </AppShell>
  );
}
