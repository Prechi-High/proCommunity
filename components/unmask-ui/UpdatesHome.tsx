import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import {
  Bell,
  ChatCircle,
  Megaphone,
  Sparkle,
  UsersThree,
} from "@/components/icons";
import { AppShell, MediaFrame, ContentSkeleton, StatusMessage } from "@/components/unmask-ui";
import { PersonAvatar } from "@/components/unmask-ui/PersonAvatar";
import { fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import { loadHomeFeed, type FeedItem } from "@/lib/unmask/feed";
import { feedForRelease } from "@/lib/unmask/publicFeed";
import { CreatorUpdates } from "@/components/unmask-ui/CreatorUpdates";

const FILTERS = ["All", "Live", "Events", "Brands", "Sellers", "Unmask"] as const;
type Filter = (typeof FILTERS)[number];

function timeAgo(value: string) {
  const ms = Math.max(0, Date.now() - +new Date(value));
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FeedImage({ item }: { item: FeedItem }) {
  const uri = item.photo || item.productImage;
  if (!uri) {
    return (
      <View style={{ flex: 1, backgroundColor: "#EEDDD7", alignItems: "center", justifyContent: "center" }}>
        <Sparkle size={38} color="#7A244E" weight="fill" />
      </View>
    );
  }
  return <MediaFrame uri={uri} label={item.productName || item.title} ratio={16 / 9} corners={false} />;
}

function FeedCard({ item }: { item: FeedItem }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(item.href as Href)}
      style={({ pressed }) => ({
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: "#FFF9F7",
        borderWidth: 1,
        borderColor: "#E7D9D5",
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View style={{ height: 170 }}>
        <FeedImage item={item} />
        <View style={{ position: "absolute", left: 12, top: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F9D2C9" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: "#572032" }}>
            {item.kind === "question" ? "Community question" : item.kind === "experience" ? "Real experience" : "Unmask"}
          </Text>
        </View>
      </View>
      <View style={{ padding: 13, gap: 7 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 21, color: "#241329" }}>
          {item.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PersonAvatar id={item.authorId || item.author} name={item.author} size={27} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: "#665C64" }}>
            {item.author} · {timeAgo(item.createdAt)}
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#6E183C" }}>
            {item.replies ?? 0} replies
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function UpdatesHome() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const [filter, setFilter] = useState<Filter>("All");
  const feed = useQuery({
    queryKey: ["updates-feed"],
    queryFn: loadHomeFeed,
    staleTime: 20_000,
  });

  const items = useMemo(() => {
    const live = feedForRelease(feed.data || []);
    if (filter === "Unmask") return live.filter((x) => x.kind === "unmask");
    if (filter === "Live" || filter === "Events" || filter === "Brands" || filter === "Sellers") return [];
    return live;
  }, [feed.data, filter]);

  const hero = items[0];
  const trending = items.slice(1, 4);
  const rest = items.slice(4, 10);

  return (
    <AppShell navigation flush scroll={false} ambient="page" hideHeader>
      <View style={{ flex: 1, backgroundColor: "#FEF4F2" }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 150, gap: 14 }}>
          <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 31, color: "#6E183C", letterSpacing: -1.1 }}>Unmask</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
              <Pressable onPress={() => router.push("/notifications" as Href)} accessibilityLabel="Notifications">
                <Bell size={29} color="#241329" />
                <View style={{ position: "absolute", right: -1, top: 1, width: 8, height: 8, borderRadius: 4, backgroundColor: "#C94B72" }} />
              </Pressable>
              <PersonAvatar id={profile?.id || "you"} name={profile?.displayName || "You"} size={43} />
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 2.3, color: "#7D5B64" }}>WHAT'S HAPPENING</Text>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 38, lineHeight: 42, color: "#241329", letterSpacing: -1 }}>Updates</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: "#766B73" }}>
              What’s happening across the Unmask world.
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <Pressable key={f} onPress={() => setFilter(f)} style={{ minHeight: 40, paddingHorizontal: 15, borderRadius: 999, backgroundColor: active ? "#74164D" : "#FFF8F6", borderWidth: active ? 0 : 1, borderColor: "#DCCED0", flexDirection: "row", alignItems: "center", gap: 7 }}>
                  {f === "All" ? <UsersThree size={16} color={active ? "#FFF" : "#5C4650"} /> : f === "Events" ? <Megaphone size={16} color={active ? "#FFF" : "#5C4650"} /> : f === "Unmask" ? <Sparkle size={16} color={active ? "#FFF" : "#5C4650"} /> : null}
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? "#FFF" : "#332533" }}>{f}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {feed.isLoading ? <ContentSkeleton rows={3} /> : null}

          {hero ? (
            <Pressable onPress={() => router.push(hero.href as Href)} style={{ borderRadius: 24, overflow: "hidden", minHeight: 285, backgroundColor: "#4C2730" }}>
              <FeedImage item={hero} />
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 18, paddingTop: 55, backgroundColor: "rgba(35,13,22,0.52)" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFD6C9", letterSpacing: 1 }}>
                  {hero.kind === "question" ? "COMMUNITY QUESTION" : hero.kind === "experience" ? "NEW EXPERIENCE" : "UNMASK"}
                </Text>
                <Text numberOfLines={2} style={{ fontFamily: fonts.serifBold, fontSize: 27, lineHeight: 30, color: "#FFF9F4", marginTop: 4 }}>{hero.title}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: "#F9E8E2", marginTop: 5 }}>{hero.author} · {timeAgo(hero.createdAt)}</Text>
                <View style={{ alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: "#FFF1E9" }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#4C2730" }}>Open update  →</Text>
                </View>
              </View>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderRadius: 22, backgroundColor: "#8C245A", padding: 16, minHeight: 145 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: "#FFF8F4" }}>Community pulse</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: "#F9DDE8", marginTop: 6 }}>
                {items.length ? `${items.length} fresh updates from Unmaskers.` : "New community activity will appear here."}
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => router.push("/community" as Href)}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>Explore conversations  →</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1, borderRadius: 22, backgroundColor: "#F3DDE8", padding: 16, minHeight: 145 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: "#4C1934" }}>Creator updates</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: "#704C5F", marginTop: 6 }}>
                Fresh stories and published creator work.
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#6E183C" }}>See creator updates  →</Text>
            </View>
          </View>

          <CreatorUpdates />

          <View style={{ gap: 10, paddingTop: 3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 3 }}>
              <Text style={{ fontFamily: fonts.serifBold, fontSize: 25, color: "#3B1B2A" }}>Trending conversations</Text>
              <ChatCircle size={21} color="#6E183C" />
            </View>
            {trending.length ? trending.map((item) => <FeedCard key={item.id} item={item} />) : null}
            {!trending.length && !feed.isLoading ? (
              <StatusMessage title="No updates in this view yet." detail="As people share experiences and questions, they will appear here." />
            ) : null}
          </View>

          {rest.length ? (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: fonts.serifBold, fontSize: 25, color: "#3B1B2A" }}>More from Unmask</Text>
              {rest.map((item) => <FeedCard key={item.id} item={item} />)}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </AppShell>
  );
}
