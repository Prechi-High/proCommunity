import { TakeFurtherCard } from "@/components/unmask-ui/TakeFurtherCard";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { ReplyComposer } from "@/components/community/ReplyComposer";
import { ChatCircle } from "@/components/icons";
import { ProductIdentity } from "@/components/community/ProductIdentity";
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
  StatusMessage,
  ContentSkeleton,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import * as api from "@/lib/living/api";
import { hapticSaved } from "@/lib/haptics";
import { SAMPLE_REPLIES, sampleById } from "@/lib/unmask/samples";
import { useAppStore } from "@/lib/store";

export default function QuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useAppStore((s) => s.profile);
  const uid = profile?.id;
  const [addDetail, setAddDetail] = useState(false);
  const sample = sampleById(id);
  const q = useQuery({
    queryKey: ["question", id],
    queryFn: () => api.question(id),
    enabled: !!id && !sample,
  });
  const answers = useQuery({
    queryKey: ["answers", id],
    queryFn: () => api.answers(id),
    enabled: !!id && !sample,
  });
  const product = useQuery({
    queryKey: ["catalog", q.data?.product_id],
    queryFn: () => api.catalog(q.data!.product_id!),
    enabled: !!q.data?.product_id,
  });
  const [attachedJourney, setAttachedJourney] = useState("");
  const [attachment, setAttachment] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!uid) {
      router.push("/(auth)/sign-in" as Href);
      return;
    }
    if (busy || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.addAnswer({
        question_id: id,
        attached_experience_id: attachment || null,
        attached_journey_id: attachedJourney || null,
        duration: "",
        context: "",
        acquisition: "not_stated",
        body: body.trim(),
        uncertainty: "",
      });
      hapticSaved(id);
      setBody("");
      setAttachment("");
      setAttachedJourney("");
      await qc.invalidateQueries({ queryKey: ["answers", id] });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Reply didn’t send. Your text is still here.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (sample) {
    const thread = SAMPLE_REPLIES[sample.id] ?? [];
    return (
      <AppShell
        back
        navigation
        title="Question"
        subtitle={`Asked by ${sample.author}`}
      >
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            color: colors.inkSoft,
          }}
        >
          Design sample · not a live member question.
        </Text>
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
            fontSize: 16,
            lineHeight: 24,
            color: colors.inkSoft,
          }}
        >
          {sample.body}
        </Text>
        {thread.map((a) => (
          <View
            key={a.id}
            style={{ flexDirection: "row", gap: 12, paddingVertical: 4 }}
          >
            <Avatar name={a.author} uri={a.avatar} size={32} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                  color: colors.ink,
                }}
              >
                {a.author}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.ink,
                }}
              >
                {a.body}
              </Text>
            </View>
          </View>
        ))}
        <ActionButton
          label="Sign in to answer"
          onPress={() => router.push("/(auth)/sign-in" as Href)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      back
      navigation
      title="Question"
      subtitle={
        q.data?.author_name ? `Asked by ${q.data.author_name}` : undefined
      }
    >
      {q.isLoading ? <ContentSkeleton /> : null}
      {q.data?.product_id ? (
        <ProductIdentity
          name={product.data?.[0]?.name || "Product"}
          brand={product.data?.[0]?.brand}
          image={product.data?.[0]?.image_url}
          loading={product.isLoading}
        />
      ) : null}
      {q.data?.skin_type ? (
        <StatusMessage
          title={`${q.data.skin_type} skin`}
          detail="Context shared by the person asking."
        />
      ) : null}
      {q.data?.context ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            color: colors.inkSoft,
          }}
        >
          {q.data.context}
        </Text>
      ) : null}
      {answers.isLoading ? <ContentSkeleton rows={2} /> : null}
      {q.isError ? (
        <StatusMessage kind="error" title="This question isn’t available." />
      ) : null}
      {q.data ? (
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 20,
            lineHeight: 26,
            color: colors.ink,
          }}
        >
          {q.data.body}
        </Text>
      ) : null}
      {q.data ? <View style={{flexDirection:"row",gap:10,alignItems:"center"}}><PersonAvatar id={q.data.user_id} name={q.data.author_name} size={34}/><Text style={{fontFamily:fonts.semibold,color:colors.ink}}>{q.data.author_name}</Text></View> : null}
      {(answers.data ?? []).map((a) => (
        <View key={a.id} style={{ gap: 8 }}>
          <PersonAvatar id={a.user_id} name={a.author_name} size={32}/>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 14,
              color: colors.ink,
            }}
          >
            {a.author_name}
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 16,
              lineHeight: 24,
              color: colors.ink,
            }}
          >
            {a.body}
          </Text>
          <AttachedExperienceLink
            attachedBy={a.author_name}
            id={a.attached_experience_id}
            journeyId={a.attached_journey_id}
          />
        </View>
      ))}
      {q.data && answers.isSuccess && !answers.data.length ? (
        <View style={{ paddingVertical: 34, alignItems: "center", gap: 10 }}>
          <ChatCircle size={32} color={colors.inkSoft} />
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 20,
              color: colors.ink,
            }}
          >
            No replies yet
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 15,
              lineHeight: 23,
              color: colors.inkSoft,
              textAlign: "center",
            }}
          >
            {q.data.user_id === uid
              ? "Your question is out there. We’ll let you know when someone replies."
              : "Tried this product? Your experience could help."}
          </Text>
        </View>
      ) : null}
      {answers.isError ? (
        <StatusMessage
          kind="error"
          title="Replies couldn’t load"
          detail="Try opening this conversation again."
        />
      ) : null}
      {q.data && (q.data.user_id !== uid || addDetail) ? (
        <ReplyComposer
          name={profile?.displayName || "You"}
          body={body}
          onChange={setBody}
          onSend={() => void send()}
          pending={busy}
          hasAttachment={!!(attachment || attachedJourney)}
          attachment={
            <ExperienceAttachment
              productId={q.data.product_id}
              value={attachment}
              onChange={setAttachment}
              journeyValue={attachedJourney}
              onJourneyChange={setAttachedJourney}
            />
          }
        />
      ) : q.data ? (
        <ActionButton
          tone="ghost"
          label="Add more context to my question"
          onPress={() => setAddDetail(true)}
        />
      ) : null}
      {error ? (
        <StatusMessage kind="error" title="Reply didn’t send." detail={error} />
      ) : null}
      {q.data?.product_id ? (
        <TakeFurtherCard
          onPress={() =>
            router.push(
              `/investigation/request?question=${id}&product=${q.data?.product_id}` as Href,
            )
          }
        />
      ) : null}
    </AppShell>
  );
}
