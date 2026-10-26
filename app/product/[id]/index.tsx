import { searchCommunityProducts } from "@/lib/unmask/communitySearch";
import { exactCommunityMatch } from "@/lib/unmask/productIdentityMatch";
import { SAMPLE_FEED, SAMPLE_SHELF } from "@/lib/unmask/samples";
import { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import {
  ActionButton,
  AppShell,
  EmptyState,
  FilterChips,
  MediaFrame,
  StatusMessage,
  StoryCard,
  ContentSkeleton,
} from "@/components/unmask-ui";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChatCircle,
  Plus,
  Clock,
  ArrowRight,
  UsersThree,
} from "@/components/icons";
import { ProductIdentity } from "@/components/community/ProductIdentity";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import { routeId } from "@/lib/catalog";
import * as clarity from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import { browse } from "@/lib/today/api";
import {
  experienceToFeed,
  questionToFeed,
  unmaskToFeed,
} from "@/lib/unmask/feed";
import { getKnownProduct } from "@/lib/products";
import { useAppStore } from "@/lib/store";

export default function ProductPage() {
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const originalId = routeId(id);
  const original = useAppStore((s) => s.knownProducts[originalId]);
  const canonical = useQuery({
    queryKey: ["canonical-community-product", originalId, original?.name, q],
    enabled: !!(original?.name || q) && !originalId.startsWith("demo-"),
    queryFn: async () => {
      const identity = original || { name: q || "", brand: "" };
      return exactCommunityMatch(
        identity,
        await searchCommunityProducts(identity.name),
      );
    },
  });
  const pid = canonical.data?.id || originalId;
  const uid = useAppStore((s) => s.profile?.id);
  const qc = useQueryClient();
  const [skin, setSkin] = useState("All skin types");
  const following = useQuery({
    queryKey: ["subscriptions", uid],
    queryFn: living.subscriptions,
    enabled: !!uid,
  });
  const isFollowing = following.data?.some(
    (s) => s.target_type === "product" && s.target_id === pid,
  );
  const follow = useMutation({
    mutationFn: () =>
      isFollowing
        ? living.unfollow("product", pid)
        : living.follow("product", pid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
  const router = useRouter();
  const known = useAppStore((s) => s.knownProducts[pid]);
  const addRecent = useAppStore((s) => s.addRecentProduct);
  useEffect(() => {
    if (pid) addRecent(pid);
  }, [pid, addRecent]);

  const catalog = useQuery({
    queryKey: ["catalog", pid],
    queryFn: () => living.catalog(pid),
  });
  const experiences = useQuery({
    queryKey: ["product-experiences", pid],
    queryFn: () => clarity.experiences(false, pid),
  });
  const questions = useQuery({
    queryKey: ["product-questions", pid],
    queryFn: () => living.questions(pid),
  });
  const unmasks = useQuery({
    queryKey: ["product-unmasks", pid],
    queryFn: () => browse(q || known?.name || "", "All", "Recent"),
  });

  const timelines = useQuery({
    queryKey: ["product-public-timelines", pid],
    queryFn: async () => {
      const { data, error } = await clarity
        .db()
        .from("unmask_journeys")
        .select(
          "id,usage_duration,frequency,skin_type,status,ownership_verified",
        )
        .eq("product_id", pid)
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const example = SAMPLE_SHELF.find((x) => x.id === pid);
  const row = catalog.data?.[0];
  const product = known || getKnownProduct(pid) || original;
  const name =
    row?.name || product?.name || example?.name || q || pid.replace(/-/g, " ");
  const image = row?.image_url || product?.heroImageUrl || example?.image;
  const experienceRows = experiences.data ?? [];
  const stories = example
    ? SAMPLE_FEED.filter((x) => x.kind === "experience" && x.productId === pid)
    : experienceRows
        .filter((e) => skin === "All skin types" || e.skin_type === skin)
        .map(experienceToFeed);
  const skinOptions = [
    "All skin types",
    ...new Set(
      experienceRows.map((e) => e.skin_type).filter((s): s is string => !!s),
    ),
  ];
  const asks = example
    ? SAMPLE_FEED.filter((x) => x.kind === "question" && x.productId === pid)
    : (questions.data ?? []).map((item) => questionToFeed(item, name, image));
  const cases = example
    ? SAMPLE_FEED.filter((x) => x.kind === "unmask" && x.productId === pid)
    : (unmasks.data ?? [])
        .filter((u) => u.product_id === pid || u.product_name === name)
        .map(unmaskToFeed);

  const waiting =
    !example &&
    (canonical.isLoading ||
      experiences.isLoading ||
      questions.isLoading ||
      timelines.isLoading);
  const count =
    stories.length + asks.length + cases.length + (timelines.data?.length || 0);
  const ask = () => router.push(`/product/${pid}/ask-community` as Href);
  return (
    <AppShell
      back
      navigation
      title="Meet the product."
      subtitle="People’s experiences. The context behind them."
    >
      <ProductIdentity
        name={name}
        image={image}
        brand={row?.brand || product?.brand || example?.brand}
        loading={catalog.isLoading && !product && !example}
      />
      <LinearGradient
        colors={["#F1F5ED", "#F9F6EF"]}
        style={{ padding: 22, borderRadius: 25, gap: 13 }}
      >
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <UsersThree size={22} color={colors.sageInk} />
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 21,
              color: colors.ink,
            }}
          >
            Start with people who’ve tried it.
          </Text>
        </View>
        {waiting ? (
          <ContentSkeleton rows={2} />
        ) : (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 15,
              lineHeight: 23,
              color: colors.inkSoft,
            }}
          >
            {count
              ? `${stories.length} experiences · ${asks.length} questions · ${cases.length} Ultra Unmasks${timelines.data?.length ? ` · ${timelines.data.length} shared timelines` : ""}. Explore what happened, how they used it and what changed.`
              : "The community hasn’t shared much about this product yet. Your question can start the conversation."}
          </Text>
        )}
        <ActionButton
          icon={<ChatCircle size={20} color="#fff" />}
          label="I have a question"
          onPress={ask}
        />
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 12,
            lineHeight: 18,
            color: colors.inkSoft,
          }}
        >
          Ask even if someone has already posted. Your skin, routine and
          question may be different.
        </Text>
      </LinearGradient>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ActionButton
            tone="secondary"
            label="Track my use"
            disabled={!!example}
            onPress={() =>
              router.push(
                `/products/add?product=${encodeURIComponent(pid)}` as Href,
              )
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            tone="secondary"
            label="Share my experience"
            disabled={!!example}
            onPress={() =>
              router.push(
                `/contribute?product=${encodeURIComponent(pid)}` as Href,
              )
            }
          />
        </View>
      </View>
      <ActionButton
        tone="ghost"
        label={isFollowing ? "Following product" : "Follow product updates"}
        disabled={!!example}
        pending={follow.isPending}
        onPress={() => (uid ? follow.mutate() : router.push("/(auth)/sign-in"))}
      />
      {follow.isError ? (
        <StatusMessage
          kind="error"
          title="Following wasn’t updated"
          detail={follow.error.message}
        />
      ) : null}
      {example ? (
        <StatusMessage
          title="Fictional demo product"
          detail="These stories illustrate the community. They are not product claims."
        />
      ) : null}
      <Text style={section}>Real experiences</Text>
      {skinOptions.length > 1 ? (
        <FilterChips options={skinOptions} value={skin} onChange={setSkin} />
      ) : null}
      {!example && (canonical.isLoading || experiences.isLoading) ? (
        <ContentSkeleton />
      ) : experiences.isError && !example ? (
        <StatusMessage
          kind="error"
          title="Experiences couldn’t load. Please retry."
        />
      ) : stories.length ? (
        stories.map((item) => <StoryCard key={item.id} item={item} />)
      ) : (
        <EmptyState
          title="No shared experiences here yet."
          detail="Ask people who have used it, or bring your own experience."
          action="Ask the community"
          onAction={ask}
        />
      )}
      {timelines.isLoading && !example ? (
        <ContentSkeleton rows={1} />
      ) : timelines.data?.length ? (
        <>
          <Text style={section}>See the story over time</Text>
          {timelines.data.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="link"
              onPress={() => router.push(`/journey/${t.id}` as Href)}
              style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: "#F7F0E2",
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
              }}
            >
              <Clock size={24} color={colors.brand} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 16,
                    color: colors.ink,
                  }}
                >
                  {[t.usage_duration, t.frequency]
                    .filter(Boolean)
                    .join(" · ") || "A shared product timeline"}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 13,
                    color: colors.inkSoft,
                  }}
                >
                  {t.skin_type ? `${t.skin_type} skin · ` : ""}Dated updates and
                  real usage context
                  {t.ownership_verified ? " · Ownership verified" : ""}
                </Text>
              </View>
              <ArrowRight size={18} color={colors.brand} />
            </Pressable>
          ))}
        </>
      ) : null}
      <Text style={section}>Questions people are asking</Text>
      {!example && questions.isLoading ? (
        <ContentSkeleton />
      ) : questions.isError && !example ? (
        <StatusMessage kind="error" title="Questions couldn’t load." />
      ) : asks.length ? (
        asks.map((item) => <StoryCard key={item.id} item={item} />)
      ) : (
        <Text style={bodyStyle}>
          No questions yet. What would help you decide?
        </Text>
      )}
      <ActionButton
        tone="secondary"
        label="Ask another question"
        onPress={ask}
      />
      {cases.length ? (
        <>
          <Text style={section}>Taken further with Ultra Unmask</Text>
          {cases.map((item) => (
            <StoryCard key={item.id} item={item} />
          ))}
        </>
      ) : !example && unmasks.isLoading ? (
        <ContentSkeleton rows={1} />
      ) : null}
    </AppShell>
  );
}
const section = {
  fontFamily: fonts.semibold,
  fontSize: 21,
  lineHeight: 28,
  color: colors.ink,
  marginTop: 10,
};
const bodyStyle = {
  fontFamily: fonts.regular,
  fontSize: 15,
  lineHeight: 23,
  color: colors.inkSoft,
};
