import { SAMPLE_FEED, SAMPLE_SHELF } from "@/lib/unmask/samples";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
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
} from "@/components/unmask-ui";
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
  const pid = routeId(id);
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

  const example = SAMPLE_SHELF.find((x) => x.id === pid);
  const row = catalog.data?.[0];
  const product = known || getKnownProduct(pid);
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

  return (
    <AppShell
      back
      navigation
      title={name}
      subtitle={
        row?.brand ||
        product?.brand ||
        "Lived stories. Updated as people keep using it."
      }
    >
      <MediaFrame uri={image} label={name} ratio={16 / 10} overlay />
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 14,
          color: colors.inkSoft,
        }}
      >
        {stories.length} lived stories · {asks.length} questions ·{" "}
        {cases.length} Ultra Unmasks
      </Text>
      <ActionButton
        disabled={!!example}
        label={COPY.createExperience}
        onPress={() => router.push(`/contribute?product=${pid}` as Href)}
      />
      <ActionButton
        tone="secondary"
        label="Ask the community"
        onPress={() => router.push(`/product/${pid}/ask-community` as Href)}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 130 }}>
          <ActionButton
            tone="ghost"
            disabled={!!example}
            label={isFollowing ? "Following product" : "Follow product"}
            pending={follow.isPending}
            onPress={() =>
              uid ? follow.mutate() : router.push("/(auth)/sign-in" as Href)
            }
          />
        </View>
        <View style={{ flex: 1, minWidth: 130 }}>
          <ActionButton
            tone="ghost"
            disabled={!!example}
            label="Track my experience"
            onPress={() =>
              router.push(
                `/products/add?product=${encodeURIComponent(pid)}` as Href,
              )
            }
          />
        </View>
      </View>
      {follow.isError ? (
        <StatusMessage
          kind="error"
          title="Couldn’t update following"
          detail={follow.error.message}
        />
      ) : null}
      <View
        style={{
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 16,
          gap: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.semibold,
            fontSize: 18,
            color: colors.ink,
          }}
        >
          At a glance
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            lineHeight: 23,
            color: colors.inkSoft,
          }}
        >
          {example
            ? "Fictional demo product and experiences. Explore the stories below to preview the community."
            : experienceRows.length
              ? `${experienceRows.length} shared experiences. ${experienceRows.filter((e) => !!e.frequency).length} include usage frequency; ${experienceRows.filter((e) => !!e.skin_type).length} include skin type. Read the context before drawing conclusions.`
              : "We have basic product information, but no shared experiences yet. Ask the community or add what happened when you used it."}
        </Text>
      </View>
      {skinOptions.length > 1 ? (
        <FilterChips options={skinOptions} value={skin} onChange={setSkin} />
      ) : null}
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 13,
          letterSpacing: 0.5,
          color: colors.inkSoft,
        }}
      >
        STORIES
      </Text>
      {experiences.isError ? (
        <StatusMessage kind="error" title="Stories didn’t load." />
      ) : null}
      {stories.length ? (
        stories.map((item) => <StoryCard key={item.id} item={item} />)
      ) : (
        <EmptyState title={COPY.noStories} detail={COPY.noStoriesNext} />
      )}

      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 13,
          letterSpacing: 0.5,
          color: colors.inkSoft,
        }}
      >
        QUESTIONS AND ULTRA UNMASKS
      </Text>
      {asks.map((item) => (
        <StoryCard key={item.id} item={item} />
      ))}
      {cases.map((item) => (
        <StoryCard key={item.id} item={item} />
      ))}

      <View style={{ gap: 8 }}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            letterSpacing: 0.5,
            color: colors.inkSoft,
          }}
        >
          ABOUT THIS PRODUCT
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 16,
            lineHeight: 24,
            color: colors.inkSoft,
          }}
        >
          Experiences are personal reports. Product versions, usage and
          individual circumstances can differ. Company responses and creator
          findings are labeled separately.
        </Text>
        <ActionButton
          tone="ghost"
          label="See offers · unmask first"
          onPress={() => router.push("/offers" as Href)}
        />
      </View>
    </AppShell>
  );
}
