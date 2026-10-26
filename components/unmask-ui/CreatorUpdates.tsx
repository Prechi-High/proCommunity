import { ContentSkeleton } from "./Skeleton";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Sparkle, ArrowRight } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import { hapticSelect } from "@/lib/haptics";
import * as community from "@/lib/community-v2/api";
import { SAMPLE_CREATORS, SAMPLE_FEED } from "@/lib/unmask/samples";
import { ActionSheet } from "./ActionSheet";
import { ActionButton } from "./ActionButton";
import { Avatar } from "./Avatar";
import { MediaFrame } from "./MediaFrame";
import { StatusMessage } from "./StatusMessage";
type Update = {
  id: string;
  creatorId: string;
  title: string;
  image?: string | null;
  href?: string;
  video?: string;
  label: string;
};
type Person = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
};
function UpdateCircle({
  person,
  unread,
  hasUpdate,
  onPress,
}: {
  person: Person;
  unread: boolean;
  hasUpdate: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.display_name}, ${unread ? "new update" : hasUpdate ? "update seen" : "creator profile"}`}
      onPress={onPress}
      onPressIn={() => {
        scale.value = reduced ? 1 : withTiming(0.91, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 13, stiffness: 240 });
      }}
      style={{ width: 88, alignItems: "center", gap: 7 }}
    >
      <Animated.View style={motion}>
        <LinearGradient
          colors={
            unread
              ? ["#F2D25B", "#A64460", "#4B1B2A"]
              : ["#D9D2CD", "#D9D2CD", "#D9D2CD"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: unread ? 3 : 1.5, borderRadius: 48 }}
        >
          <View
            style={{
              padding: 3,
              borderRadius: 44,
              backgroundColor: "#fff",
              borderWidth: hasUpdate ? 0 : 1,
              borderStyle: "dashed",
              borderColor: "#B6A8A0",
            }}
          >
            <Avatar
              name={person.display_name}
              uri={person.avatar_url}
              size={64}
            />
          </View>
        </LinearGradient>
        {unread ? (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              backgroundColor: colors.brand,
              borderColor: "#fff",
              borderWidth: 2,
              borderRadius: 12,
              padding: 3,
            }}
          >
            <Sparkle size={12} weight="fill" color="#F2D25B" />
          </View>
        ) : null}
      </Animated.View>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}
      >
        {person.display_name.split(" ")[0]}
      </Text>
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 10,
          color: unread ? colors.brand : colors.inkSoft,
        }}
      >
        {unread ? "New update" : hasUpdate ? "Seen" : "Creator"}
      </Text>
    </Pressable>
  );
}
export function CreatorUpdates() {
  const r = useRouter();
  const demo = useAppStore((s) => s.demoCommunity);
  const uid = useAppStore((s) => s.profile?.id);
  const seen = useAppStore((s) => s.creatorUpdatesSeen);
  const markSeen = useAppStore((s) => s.seeCreatorUpdate);
  const [selected, setSelected] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const people = useQuery({
    queryKey: ["creators"],
    queryFn: community.creators,
    enabled: !demo,
  });
  const publications = useQuery({
    queryKey: ["creator-updates"],
    queryFn: () => community.publications(),
    enabled: !demo,
    staleTime: 30000,
  });
  const persons: Person[] = demo ? SAMPLE_CREATORS : (people.data ?? []);
  const updates: Update[] = demo
    ? SAMPLE_FEED.filter((x) => x.creatorName).map((x) => ({
        id: `${x.id}:${x.status}`,
        creatorId: x.authorId!,
        title: x.title,
        image: x.photo,
        href: x.href,
        label: x.status || "Creator update",
      }))
    : (publications.data ?? []).map((p) => ({
        id: p.id,
        creatorId: p.creator_id,
        title: p.title,
        image: p.thumbnail_url,
        video: p.video_url,
        label: "New Ultra Unmask",
      }));
  const readKey = (id: string) =>
    `${uid || "guest"}:${demo ? "demo" : "live"}:${id}`;
  const latest = (id: string) => updates.find((u) => u.creatorId === id);
  const ordered = [...persons].sort(
    (a, b) =>
      Number(
        !!latest(b.user_id) &&
          seen[readKey(b.user_id)] !== latest(b.user_id)?.id,
      ) -
      Number(
        !!latest(a.user_id) &&
          seen[readKey(a.user_id)] !== latest(a.user_id)?.id,
      ),
  );
  const currentPerson = persons.find((p) => p.user_id === selected);
  const currentUpdates = updates.filter((u) => u.creatorId === selected);
  const current = currentUpdates[index];
  function open(p: Person) {
    hapticSelect();
    const update = latest(p.user_id);
    if (!update) {
      r.push(`/member/${p.user_id}` as Href);
      return;
    }
    setSelected(p.user_id);
    setIndex(0);
    setError("");
    markSeen(readKey(p.user_id), update.id);
  }
  return (
    <View style={{ gap: 14, paddingTop: 6 }}>
      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ gap: 3 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.semibold,
              fontSize: 19,
              color: colors.ink,
            }}
          >
            Creator updates
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12,
              color: colors.inkSoft,
            }}
          >
            {demo
              ? "Demo creators · tap a ring to explore"
              : "Fresh answers. Familiar faces."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="See all creators"
          onPress={() => r.push("/creators")}
          style={{ padding: 12 }}
        >
          <ArrowRight size={20} color={colors.brand} />
        </Pressable>
      </View>
      {ordered.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 10,
            paddingHorizontal: 18,
            paddingBottom: 4,
          }}
        >
          {ordered.slice(0, 20).map((p) => (
            <UpdateCircle
              key={p.user_id}
              person={p}
              hasUpdate={!!latest(p.user_id)}
              unread={
                !!latest(p.user_id) &&
                seen[readKey(p.user_id)] !== latest(p.user_id)?.id
              }
              onPress={() => open(p)}
            />
          ))}
        </ScrollView>
      ) : (
        <View
          style={{
            marginHorizontal: 20,
            padding: 16,
            borderRadius: 18,
            backgroundColor: "#F7F2ED",
          }}
        >
          {people.isLoading ? <ContentSkeleton rows={1} /> : null}
          <Text
            style={{
              fontFamily: fonts.regular,
              color: colors.inkSoft,
              fontSize: 13,
            }}
          >
            {people.isLoading
              ? ""
              : people.isError
                ? "Creator updates couldn’t load."
                : "Creator updates will appear here as they publish."}
          </Text>
          {people.isError ? (
            <ActionButton
              label="Retry creators"
              tone="ghost"
              onPress={() => void people.refetch()}
            />
          ) : null}
        </View>
      )}
      {!demo && publications.isError ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ActionButton
            label="Retry creator updates"
            tone="ghost"
            onPress={() => void publications.refetch()}
          />
        </View>
      ) : null}
      <ActionSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          currentPerson
            ? `${currentPerson.display_name} · Updates`
            : "Creator updates"
        }
      >
        {demo ? (
          <StatusMessage
            title="Demo creator update"
            detail="Fictional progress, not a real brand or expert response."
          />
        ) : null}
        {current ? (
          <>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {currentUpdates.map((u, i) => (
                <View
                  key={u.id}
                  style={{
                    height: 3,
                    flex: 1,
                    borderRadius: 3,
                    backgroundColor: i <= index ? colors.brand : "#E8DFD8",
                  }}
                />
              ))}
            </View>
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 12,
                color: colors.brand,
              }}
            >
              {current.label}
            </Text>
            {current.image ? (
              <MediaFrame
                uri={current.image}
                label="Creator update cover"
                ratio={16 / 9}
                corners={false}
              />
            ) : null}
            <Text
              style={{
                fontFamily: fonts.serifBold,
                fontSize: 26,
                lineHeight: 31,
                color: colors.ink,
              }}
            >
              {current.title}
            </Text>
            <ActionButton
              label={current.video ? "Watch the update" : "Open this story"}
              onPress={() => {
                if (current.href) {
                  setSelected(null);
                  r.push(current.href as Href);
                } else if (current.video && /^https:\/\//i.test(current.video))
                  void Linking.openURL(current.video).catch(() =>
                    setError("Couldn’t open this video."),
                  );
              }}
            />
            {index < currentUpdates.length - 1 ? (
              <ActionButton
                tone="secondary"
                label="Next update"
                onPress={() => setIndex((i) => i + 1)}
              />
            ) : null}
            <ActionButton
              tone="ghost"
              label="View creator profile"
              onPress={() => {
                setSelected(null);
                r.push(`/member/${selected}` as Href);
              }}
            />
            {error ? <StatusMessage kind="error" title={error} /> : null}
          </>
        ) : null}
      </ActionSheet>
    </View>
  );
}
