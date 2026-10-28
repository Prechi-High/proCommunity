import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { identity } from "@/lib/profiles/api";
import { Bell, Check, PencilSimple } from "@/components/icons";
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
          "id,user_id,usage_duration,frequency,skin_type,status,ownership_verified",
        )
        .eq("product_id", pid)
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return Promise.all(
        (data ?? []).map(async (t) => ({
          ...t,
          person: await identity(t.user_id),
        })),
      );
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
      title={name}
      subtitle="The people. The questions. The story so far."
    >
      <View
        style={{
          padding: 20,
          borderRadius: 26,
          backgroundColor: "#F7F3EF",
          gap: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
          <View style={{ width: 106 }}>
            <MediaFrame uri={image} label={name} ratio={1} corners={false} />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 23,
                lineHeight: 29,
                color: colors.ink,
              }}
            >
              {name}
            </Text>
            <Text style={bodyStyle}>
              A product brings us together. People bring the context.
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFollowing ? "Unfollow this product" : "Follow this product"
          }
          accessibilityState={{
            selected: !!isFollowing,
            disabled: !!example || follow.isPending,
          }}
          disabled={!!example || follow.isPending}
          onPress={() =>
            uid
              ? follow.mutate()
              : router.push({
                  pathname: "/(auth)/sign-in",
                  params: { returnTo: `/product/${pid}` },
                } as Href)
          }
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 17,
            paddingVertical: 11,
            borderRadius: 99,
            backgroundColor: isFollowing ? "#E8E1E5" : colors.brandDeep,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          {isFollowing ? (
            <Check size={18} color={colors.ink} />
          ) : (
            <Bell size={18} color="#fff" />
          )}
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 14,
              color: isFollowing ? colors.ink : "#fff",
            }}
          >
            {follow.isPending
              ? "Updating…"
              : isFollowing
                ? "Following"
                : "Follow product"}
          </Text>
        </Pressable>
        <Text style={{ ...bodyStyle, fontSize: 12, lineHeight: 18 }}>
          Follow for new public experiences, questions and Ultra Unmasks in your
          notifications.
        </Text>
      </View>
      {waiting ? (
        <ContentSkeleton rows={1} />
      ) : (
        <Text style={bodyStyle}>
          {count
            ? `${stories.length} experiences · ${asks.length} questions · ${timelines.data?.length || 0} timelines · ${cases.length} Ultra Unmasks`
            : "No public experiences yet. Your question could start the conversation."}
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          {
            label: "Track my use",
            detail: "Keep your own story",
            Icon: Clock,
            path: `/products/add?product=${encodeURIComponent(pid)}`,
          },
          {
            label: "Share my experience",
            detail: "Help someone decide",
            Icon: PencilSimple,
            path: `/contribute?product=${encodeURIComponent(pid)}`,
          },
        ].map(({ label, detail, Icon, path }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            disabled={!!example}
            onPress={() => router.push(path as Href)}
            style={({ pressed }) => ({
              flex: 1,
              padding: 17,
              borderRadius: 21,
              borderWidth: 1,
              borderColor: "#E7DDE1",
              gap: 10,
              backgroundColor: pressed ? "#F3E8ED" : "#fff",
              opacity: example ? 0.5 : 1,
            })}
          >
            <Icon size={23} color={colors.brandDeep} />
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 15,
                color: colors.ink,
              }}
            >
              {label}
            </Text>
            <Text style={{ ...bodyStyle, fontSize: 12, lineHeight: 18 }}>
              {detail}
            </Text>
            <ArrowRight size={18} color={colors.brandDeep} />
          </Pressable>
        ))}
      </View>
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
              <PersonAvatar
                id={t.user_id}
                name={t.person?.display_name}
                uri={t.person?.avatar_url}
                size={34}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 16,
                    color: colors.ink,
                  }}
                >
                  {t.person?.display_name || "Unmasker"}’s timeline{"\n"}
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
      <Pressable
        accessibilityRole="button"
        onPress={ask}
        style={({ pressed }) => ({
          flexDirection: "row",
          gap: 13,
          alignItems: "center",
          padding: 18,
          borderRadius: 22,
          backgroundColor: pressed ? "#EDE1E7" : "#F4EAF0",
        })}
      >
        <ChatCircle size={25} color={colors.brandDeep} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 17,
              color: colors.ink,
            }}
          >
            Ask the community
          </Text>
          <Text style={{ ...bodyStyle, fontSize: 13, lineHeight: 20 }}>
            A different question? Make it yours.
          </Text>
        </View>
        <ArrowRight size={20} color={colors.brandDeep} />
      </Pressable>
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
