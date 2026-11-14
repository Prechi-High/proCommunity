import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { BookmarkSimple, ChatCircle, Heart, Plus, SealCheck, ShareNetwork, Sparkle } from "@/components/icons";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { PREVIEW_MOMENTS, STORY_FACES, type PulseMoment } from "@/lib/social/previewMoments";
import { momentConfig } from "@/lib/moment/kinds";
import { CREATE_UNMASK_GLOW, CREATE_UNMASK_RING, storyMetaFor } from "@/lib/social/storyRail";
import { useRoomTone } from "@/lib/social/roomTone";
import * as profiles from "@/lib/profiles/api";
import { previewStoriesForPerson, nextPreviewPersonId } from "@/lib/social/personStories";
import { useAppStore } from "@/lib/store";

import { LoopClip } from "./LoopClip";
import { QuickShareBar } from "./QuickShareBar";
import { StoryViewer } from "./StoryViewer";
import { UnmaskTeasers } from "./UnmaskTeasers";

const PREVIEW_TIMES: Record<string, string> = {
  "m-ada": "2h",
  "m-zuri": "4h",
  "m-malik": "6h",
  "m-nene": "8h",
  "m-tunde": "11h",
  "m-ife": "1d",
  "m-ken": "1d",
  "m-lola": "2h",
};

export function LivingFeed({ guest }: { guest?: boolean }) {
  const router = useRouter();
  const tone = useRoomTone();
  const mine = useLocalMoments((s) => s.posts);
  const stories = useLocalMoments((s) => s.stories);
  const pruneStories = useLocalMoments((s) => s.pruneStories);
  const uid = useAppStore((s) => s.profile?.id);
  const name = useAppStore((s) => s.profile?.displayName)?.split(" ")[0] || "You";
  const identity = useQuery({
    queryKey: ["public-identity", uid, "feed"],
    queryFn: () => profiles.identity(uid!),
    enabled: !!uid,
    staleTime: 60_000,
  });
  const avatarUrl = identity.data?.avatar_url || "";
  const myStories = useMemo(() => {
    const now = Date.now();
    return stories.filter((s) => new Date(s.expiresAt).getTime() > now);
  }, [stories]);
  const ringThumb = myStories[0]?.media;

  useEffect(() => {
    pruneStories();
  }, [pruneStories]);
  const [loved, setLoved] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [storyQueue, setStoryQueue] = useState<PulseMoment[]>([]);
  const [storyStart, setStoryStart] = useState(0);
  const yours: PulseMoment[] = mine.map((post) => ({
    id: post.id,
    name,
    face: avatarUrl,
    media: post.photo || "",
    caption: post.caption || "A moment, no essay.",
    product: post.productName,
    timeline: post.timelineLabel,
    skin: post.skin,
    likes: 1,
    comments: 0,
    thread: [],
    video: post.mediaKind === "video" ? post.photo : undefined,
    stickers: post.momentKind
      ? [momentConfig(post.momentKind).title + " " + momentConfig(post.momentKind).emoji, ...(post.stickers ?? [])]
      : post.stickers,
    invite: post.destination === "both" ? "On your post and your story." : "This one is yours.",
  }));

  const goPost = () => {
    hapticSelect();
    router.push("/moment" as Href);
  };

  const openPost = (id: string) => {
    hapticSelect();
    router.push(`/pulse/${id}` as Href);
  };

  const myStoryQueue = (): PulseMoment[] =>
    myStories.map((s) => ({
      id: s.id,
      name,
      face: avatarUrl,
      media: s.mediaKind === "video" ? "" : s.media,
      video: s.mediaKind === "video" ? s.media : undefined,
      caption: s.caption || "Your story.",
      likes: 0,
      comments: 0,
      thread: [],
      invite: "Your story.",
    }));

  const [viewingPersonId, setViewingPersonId] = useState<string | null>(null);

  const openStories = (startId: string) => {
    hapticSelect();
    setViewingPersonId(startId);
    setStoryQueue(previewStoriesForPerson(startId));
    setStoryStart(0);
  };

  const openMine = () => {
    if (!myStories.length) {
      goPost();
      return;
    }
    hapticSelect();
    setViewingPersonId("you");
    setStoryQueue(myStoryQueue());
    setStoryStart(0);
  };

  const active = [...yours, ...PREVIEW_MOMENTS].find((item) => item.id === openId);

  return (
    <View style={{ gap: 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 4 }}>
        <View style={{ width: 82, alignItems: "center", gap: 8 }}>
          <View
            style={{
              position: "absolute",
              top: 8,
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: CREATE_UNMASK_GLOW,
              opacity: 0.85,
            }}
          />
          <Pressable
            onPress={openMine}
            accessibilityRole="button"
            accessibilityLabel={ringThumb ? "View your story" : "Create your Unmask"}
          >
            <LinearGradient colors={[...CREATE_UNMASK_RING]} style={{ width: 72, height: 72, borderRadius: 36, padding: 3 }}>
              {ringThumb ? (
                <Image source={{ uri: ringThumb }} style={{ flex: 1, borderRadius: 33 }} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ flex: 1, borderRadius: 33, backgroundColor: "#1A0A14", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={28} color="#FFF8F4" weight="bold" />
                </View>
              )}
            </LinearGradient>
          </Pressable>
          {myStories.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another story"
              onPress={goPost}
              style={{
                position: "absolute",
                right: 4,
                top: 50,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#FF6B9D",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#1A0A14",
              }}
            >
              <Plus size={14} color="#1A0A14" weight="bold" />
            </Pressable>
          ) : null}
          <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: tone.text, textAlign: "center" }}>
            Create your Unmask
          </Text>
        </View>
        {STORY_FACES.map((face) => {
          const meta = storyMetaFor(face.id);
          return (
            <Pressable
              key={face.id}
              accessibilityRole="button"
              accessibilityLabel={`${face.name} · ${meta.label}`}
              onPress={() => openStories(face.id)}
              style={{ width: 82, alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: meta.glow,
                }}
              />
              <LinearGradient colors={[meta.ring[0], meta.ring[1]]} style={{ width: 72, height: 72, borderRadius: 36, padding: 3 }}>
                <Image source={{ uri: face.face }} style={{ flex: 1, borderRadius: 33 }} accessibilityIgnoresInvertColors />
              </LinearGradient>
              <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: tone.muted, textAlign: "center" }}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <UnmaskTeasers />

      <QuickShareBar />

      {guest ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: tone.faint, paddingHorizontal: 16 }}>
          Join to post into this room.
        </Text>
      ) : null}

      {yours.map((item) => (
        <MomentCard
          key={item.id}
          item={item}
          loved={!!loved[item.id]}
          commentCount={item.comments}
          likeCount={item.likes + (loved[item.id] ? 1 : 0)}
          timeLabel="Just now"
          verified
          onLove={() => setLoved((s) => ({ ...s, [item.id]: !s[item.id] }))}
          onComments={() => setOpenId(item.id)}
          onOpen={() => openPost(item.id)}
        />
      ))}

      {PREVIEW_MOMENTS.map((item) => (
        <MomentCard
          key={item.id}
          item={item}
          loved={!!loved[item.id]}
          commentCount={item.comments}
          likeCount={item.likes + (loved[item.id] ? 1 : 0)}
          timeLabel={PREVIEW_TIMES[item.id] ?? "3h"}
          verified={item.id === "m-zuri" || item.id === "m-lola"}
          onLove={() => setLoved((s) => ({ ...s, [item.id]: !s[item.id] }))}
          onComments={() => setOpenId(item.id)}
          onOpen={() => openPost(item.id)}
        />
      ))}

      <ActionSheet open={!!active} title={active ? `Comments · ${active.name}` : "Comments"} onClose={() => setOpenId(null)}>
        {(active ? active.thread : []).map((row, index) => (
          <View key={`${row.name}-${index}`} style={{ gap: 2 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: tone.text }}>{row.name}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: tone.muted }}>{row.text}</Text>
          </View>
        ))}
        {!active?.thread.length ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: tone.muted }}>No comments yet. Join the post to leave the first one.</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!active) return;
            hapticSelect();
            const id = active.id;
            setOpenId(null);
            router.push(`/pulse/${id}` as Href);
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: tone.gold }}>Join the conversation</Text>
        </Pressable>
      </ActionSheet>
      <StoryViewer
        visible={storyQueue.length > 0}
        queue={storyQueue}
        startIndex={storyStart}
        onClose={() => {
          setStoryQueue([]);
          setViewingPersonId(null);
        }}
        onFinishedPerson={() => {
          if (!viewingPersonId || viewingPersonId === "you") return;
          const nextId = nextPreviewPersonId(viewingPersonId);
          if (!nextId) return;
          setViewingPersonId(nextId);
          setStoryQueue(previewStoriesForPerson(nextId));
          setStoryStart(0);
        }}
      />
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function handleFrom(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_");
}

function hashtagsFor(item: PulseMoment): string[] {
  const tags = ["#MyUnmask"];
  if (item.timeline) tags.push("#ProductTimeline");
  if (item.caption.toLowerCase().includes("grwm")) tags.push("#GRWM");
  if (item.product) tags.push(`#${item.product.split(/\s+/)[0]}`);
  return tags.slice(0, 4);
}

function MomentCard({
  item,
  loved,
  likeCount,
  commentCount,
  timeLabel,
  verified,
  onLove,
  onComments,
  onOpen,
}: {
  item: PulseMoment;
  loved: boolean;
  likeCount: number;
  commentCount: number;
  timeLabel: string;
  verified?: boolean;
  onLove: () => void;
  onComments: () => void;
  onOpen: () => void;
}) {
  const tone = useRoomTone();
  const handle = handleFrom(item.name);
  const tags = hashtagsFor(item);
  const routineTitle = item.timeline?.includes("Week") || item.timeline?.includes("Day") || item.timeline?.includes("Month")
    ? `My timeline · ${item.timeline}`
    : item.product
      ? "My routine"
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}'s post`}
      onPress={onOpen}
      style={{
        marginHorizontal: 16,
        borderRadius: livelyRadii.hero,
        overflow: "hidden",
        backgroundColor: "#140B12",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {item.face ? (
            <Image source={{ uri: item.face }} style={{ width: 40, height: 40, borderRadius: 20 }} accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#70323E", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontFamily: fonts.bold }}>{item.name.slice(0, 1)}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: tone.text }}>{handle}</Text>
              {verified ? <SealCheck size={16} color="#FF6B9D" weight="fill" /> : null}
            </View>
            {item.skin ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: tone.muted }}>Skin type · {item.skin}</Text>
            ) : null}
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: tone.faint }}>{timeLabel}</Text>
        </View>
      </View>

      <View style={{ position: "relative" }}>
        {item.video ? (
          <LoopClip uri={item.video} poster={item.media} height={420} />
        ) : item.media ? (
          <Image source={{ uri: item.media }} style={{ width: "100%", height: 420 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ height: 320, backgroundColor: "#2D1530" }} />
        )}

        {routineTitle && (item.product || item.timeline) ? (
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              maxWidth: 168,
              padding: 12,
              borderRadius: 16,
              backgroundColor: "rgba(20,11,18,0.55)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
              ...(Platform.OS === "web" ? { backdropFilter: "blur(12px)" as never } : {}),
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4", marginBottom: 8 }}>{routineTitle}</Text>
            {item.product ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: "rgba(255,248,244,0.85)" }}>{item.product}</Text>
            ) : null}
            {item.timeline ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: "rgba(255,248,244,0.65)", marginTop: 4 }}>{item.timeline}</Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: "rgba(255,107,157,0.88)",
          }}
        >
          <Sparkle size={14} color="#1A0A14" weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#1A0A14" }}>{item.stickers?.[0] || "My Unmask"}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 20 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${likeCount} likes`}
          onPress={() => {
            hapticSelect();
            onLove();
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Heart size={24} color={loved ? "#FF6B9D" : tone.text} weight={loved ? "fill" : "regular"} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: tone.text }}>{formatCount(likeCount)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${commentCount} comments`}
          onPress={() => {
            hapticSelect();
            onComments();
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <ChatCircle size={24} color={tone.text} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: tone.text }}>{commentCount}</Text>
        </Pressable>
        <ShareNetwork size={22} color={tone.muted} />
        <View style={{ flex: 1 }} />
        <BookmarkSimple size={22} color={tone.muted} />
      </View>

      <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 6 }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: tone.text }}>
          <Text style={{ fontFamily: fonts.semibold }}>{handle} </Text>
          {item.caption}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "#FF8BC8" }}>{tags.join(" ")}</Text>
      </View>
    </Pressable>
  );
}
