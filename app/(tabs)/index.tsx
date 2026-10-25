import { useScan } from "@/lib/useScan";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  AppShell,
  FilterChips,
  SearchField,
  StatusMessage,
  StoryCard,
  StorySkeleton,
  EmptyState,
  ActionButton,
  ActionSheet,
} from "@/components/unmask-ui";
import {
  DiscoveryHero,
  QuickActions,
  UltraInvitation,
} from "@/components/unmask-ui/Discovery";
import { ArrowRight, UsersThree, Storefront } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { subscriptions } from "@/lib/living/api";
import { entrySeen } from "@/lib/entry/api";
import { loadHomeFeed } from "@/lib/unmask/feed";
import { DemoBanner } from "@/components/unmask-ui/DemoBanner";
import { SAMPLE_FEED } from "@/lib/unmask/samples";
import { useAppStore } from "@/lib/store";
export default function Home() {
  const router = useRouter();
  const scan = useScan();
  const demo = useAppStore((s) => s.demoCommunity);
  const uid = useAppStore((s) => s.profile?.id);
  const [seen, setSeen] = useState<boolean | null>(null);
  const [filter, setFilter] = useState("All stories");
  const [q, setQ] = useState("");
  const [example, setExample] = useState(false);
  useEffect(() => {
    void entrySeen()
      .then(setSeen)
      .catch(() => setSeen(true));
  }, []);
  useEffect(() => {
    if (seen === false && !uid) router.replace("/welcome");
  }, [seen, uid, router]);
  const feed = useQuery({ queryKey: ["home-feed"], queryFn: loadHomeFeed });
  const subs = useQuery({
    queryKey: ["subscriptions", uid],
    queryFn: subscriptions,
    enabled: !!uid,
  });
  const rows = useMemo(() => {
    let list = demo ? SAMPLE_FEED : (feed.data ?? []);
    if (filter === "Questions")
      list = list.filter((x) => x.kind === "question");
    if (filter === "Following")
      list = list.filter((i) =>
        (subs.data ?? []).some(
          (s) =>
            (s.target_type === "product" && s.target_id === i.productId) ||
            (s.target_type === "person" && s.target_id === i.authorId),
        ),
      );
    return list;
  }, [feed.data, filter, subs.data, demo]);
  if (!uid && seen !== true) return null;
  return (
    <AppShell notify flush>
      <View style={{ gap: 20, paddingTop: 10 }}>
        <DiscoveryHero />
        <View style={{ paddingHorizontal: 20 }}>
          <SearchField
            value={q}
            onChange={setQ}
            onCamera={scan.openCamera}
            placeholder="Search a product before you buy"
            onSubmit={() => {
              if (q.trim().length > 1)
                router.push({
                  pathname: "/results",
                  params: { q: q.trim() },
                } as Href);
            }}
          />
        </View>
        <QuickActions />
        <UltraInvitation />
        <View style={{ paddingHorizontal: 20, gap: 14, paddingTop: 8 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.semibold,
                fontSize: 22,
                color: colors.ink,
              }}
            >
              Inside the community
            </Text>
            <UsersThree size={24} color={colors.brand} />
          </View>
          <DemoBanner />
          <FilterChips
            options={["All stories", "Questions", "Following"]}
            value={filter}
            onChange={setFilter}
          />
        </View>
        {!demo && feed.isError ? (
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            <StatusMessage
              kind="error"
              title="Stories couldn’t load."
              detail="Your connection may have dropped. Try again."
            />
            <ActionButton
              tone="secondary"
              label="Try again"
              onPress={() => void feed.refetch()}
            />
          </View>
        ) : filter === "Following" && !uid ? (
          <View style={{ paddingHorizontal: 20 }}>
            <EmptyState
              title="Keep your people close."
              detail="Sign in to follow products and creators. Their updates will appear here."
              action="Sign in"
              onAction={() => router.push("/(auth)/sign-in")}
            />
          </View>
        ) : (!demo && feed.isLoading) ||
          (filter === "Following" && subs.isLoading) ? (
          <StorySkeleton />
        ) : rows.length ? (
          rows.map((i) => <StoryCard key={i.id} item={i} flush />)
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <EmptyState
              title={
                filter === "Questions"
                  ? "A good question starts a conversation."
                  : filter === "Following"
                    ? "Your next discovery starts with a follow."
                    : "Be the first to share what happened."
              }
              detail="Loved a product? Noticed a change? Your experience could help someone choose."
              action="Share an experience"
              onAction={() => router.push("/contribute")}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setExample(true)}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: fonts.medium, color: colors.brand }}>
                See how a product story works
              </Text>
            </Pressable>
          </View>
        )}
        <View style={{ marginHorizontal: 20, paddingTop: 8, gap: 10 }}>
          {[
            {
              label: "Meet the Unmask Creators",
              detail: "The people taking your questions further.",
              href: "/creators",
              Icon: UsersThree,
            },
            {
              label: "Offers, with a clearer picture",
              detail: "Read real experiences before visiting a store.",
              href: "/offers",
              Icon: Storefront,
            },
          ].map(({ label, detail, href, Icon }) => (
            <Pressable
              key={href}
              accessibilityRole="link"
              onPress={() => router.push(href as Href)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                padding: 18,
                borderRadius: 18,
                backgroundColor: pressed ? "#EEE4E5" : "#F7F4F1",
              })}
            >
              <Icon size={24} color={colors.brand} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 15,
                    color: colors.ink,
                  }}
                >
                  {label}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 13,
                    lineHeight: 19,
                    color: colors.inkSoft,
                  }}
                >
                  {detail}
                </Text>
              </View>
              <ArrowRight size={18} color={colors.brand} />
            </Pressable>
          ))}
        </View>
      </View>
      {scan.sheet}
      <ActionSheet
        open={example}
        title="Example product story"
        onClose={() => setExample(false)}
      >
        <StatusMessage
          title="Illustration only"
          detail="This is a sample, not a real experience or product recommendation."
        />
        <StoryCard item={SAMPLE_FEED[0]} />
      </ActionSheet>
    </AppShell>
  );
}
