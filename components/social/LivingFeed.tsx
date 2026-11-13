import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ChatCircle, Heart, Plus } from "@/components/icons";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { PREVIEW_MOMENTS, STORY_FACES, type PulseMoment } from "@/lib/social/previewMoments";
import { useRoomTone } from "@/lib/social/roomTone";
import { useAppStore } from "@/lib/store";

import { LoopClip } from "./LoopClip";
import { StoryViewer } from "./StoryViewer";
import { UnmaskTeasers } from "./UnmaskTeasers";

export function LivingFeed({ guest }: { guest?: boolean }) {
  const router = useRouter();
  const tone = useRoomTone();
  const mine = useLocalMoments((s) => s.posts);
  const storyPhoto = useLocalMoments((s) => s.storyPhoto);
  const myStory = useLocalMoments((s) => s.story);
  const name = useAppStore((s) => s.profile?.displayName)?.split(" ")[0] || "You";
  const [loved, setLoved] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [storyQueue, setStoryQueue] = useState<PulseMoment[]>([]);
  const [storyStart, setStoryStart] = useState(0);
  const previewStories = useMemo(() => PREVIEW_MOMENTS, []);

  const yours: PulseMoment[] = mine.map((post) => ({
    id: post.id,
    name,
    face: post.photo || "",
    media: post.photo || "",
    caption: post.caption || "A moment, no essay.",
    product: post.productName,
    timeline: post.timelineLabel,
    skin: post.skin,
    likes: 1,
    comments: 0,
    thread: [],
    video: post.mediaKind === "video" ? post.photo : undefined,
    stickers: post.stickers,
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

  const youStory = (): PulseMoment => ({
    id: myStory?.id || "you-story",
    name,
    face: myStory?.photo || storyPhoto || "",
    media: myStory?.mediaKind === "video" ? "" : myStory?.photo || storyPhoto || "",
    video: myStory?.mediaKind === "video" ? myStory.photo : undefined,
    caption: myStory?.caption || "Your story.",
    product: myStory?.productName,
    timeline: myStory?.timelineLabel,
    skin: myStory?.skin,
    likes: 0,
    comments: 0,
    thread: [],
    stickers: myStory?.stickers,
    invite: "Your story.",
  });

  const openStories = (startId: string) => {
    const start = previewStories.findIndex((m) => m.id === startId);
    if (start < 0) return;
    hapticSelect();
    setStoryQueue(previewStories.slice(start));
    setStoryStart(0);
  };

  const openMine = () => {
    if (!myStory && !storyPhoto) {
      goPost();
      return;
    }
    hapticSelect();
    setStoryQueue([youStory()]);
    setStoryStart(0);
  };

  const active = [...yours, ...PREVIEW_MOMENTS].find((item) => item.id === openId);

  return (
    <View style={{ gap: 18 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingTop: 4 }}>
        <View style={{ width: 74, alignItems: "center", gap: 6 }}>
          <Pressable
            onPress={openMine}
            accessibilityRole="button"
            accessibilityLabel={storyPhoto ? "View your story" : "Add your story"}
          >
            <LinearGradient colors={["#F0CF69", "#70323E"]} style={{ width: 68, height: 68, borderRadius: 24, padding: 3 }}>
              {storyPhoto ? (
                <Image source={{ uri: storyPhoto }} style={{ flex: 1, borderRadius: 21 }} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ flex: 1, borderRadius: 21, backgroundColor: "#1A0A14", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={26} color="#F0CF69" weight="bold" />
                </View>
              )}
            </LinearGradient>
          </Pressable>
          {storyPhoto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another story"
              onPress={goPost}
              style={{ position: "absolute", right: 0, top: 46, width: 24, height: 24, borderRadius: 12, backgroundColor: "#F0CF69", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1A0A14" }}
            >
              <Plus size={14} color="#1A0A14" weight="bold" />
            </Pressable>
          ) : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: tone.text }}>You</Text>
        </View>
        {STORY_FACES.map((face) => (
          <Pressable
            key={face.id}
            accessibilityRole="button"
            accessibilityLabel={`${face.name}'s story`}
            onPress={() => openStories(face.id)}
            style={{ width: 74, alignItems: "center", gap: 6 }}
          >
            <LinearGradient colors={["#C9A227", "#8E4052", "#3D0F15"]} style={{ width: 68, height: 68, borderRadius: 24, padding: 2 }}>
              <Image source={{ uri: face.face }} style={{ flex: 1, borderRadius: 22 }} accessibilityIgnoresInvertColors />
            </LinearGradient>
            <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11, color: tone.muted }}>
              {face.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <UnmaskTeasers />

      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: tone.faint, paddingHorizontal: 16 }}>
        {guest ? "Join to post into this room. " : ""}Preview of the room. Skin, product, and timeline sit on the post. Likes and comments are part of it. Your post is the one that is actually yours.
      </Text>

      {yours.map((item) => (
        <MomentCard
          key={item.id}
          item={item}
          loved={!!loved[item.id]}
          commentCount={item.comments}
          likeCount={item.likes + (loved[item.id] ? 1 : 0)}
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
        onClose={() => setStoryQueue([])}
      />
    </View>
  );
}

function MomentCard({
  item,
  loved,
  likeCount,
  commentCount,
  onLove,
  onComments,
  onOpen,
}: {
  item: PulseMoment;
  loved: boolean;
  likeCount: number;
  commentCount: number;
  onLove: () => void;
  onComments: () => void;
  onOpen: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}'s post`} onPress={onOpen} style={{ marginHorizontal: 12, borderRadius: livelyRadii.hero, overflow: "hidden", backgroundColor: "#120810" }}>
      {item.video ? (
        <LoopClip uri={item.video} poster={item.media} height={460} />
      ) : item.media ? (
        <Image source={{ uri: item.media }} style={{ width: "100%", height: 460 }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ height: 280, backgroundColor: "#2D1530" }} />
      )}
      <LinearGradient colors={["transparent", "rgba(10,4,8,0.15)", "rgba(10,4,8,0.94)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {item.face ? (
            <Image source={{ uri: item.face }} style={{ width: 36, height: 36, borderRadius: 18 }} accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#70323E", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontFamily: fonts.bold }}>{item.name.slice(0, 1)}</Text>
            </View>
          )}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#fff", flex: 1 }}>{item.name}</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: "#FFF8F4" }}>{item.caption}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {item.skin ? <Chip label={`Skin · ${item.skin}`} gold /> : null}
          {item.product ? <Chip label={item.product} /> : null}
          {item.timeline ? <Chip label={item.timeline} /> : null}
          {item.stickers?.map((label) => <Chip key={label} label={label} />)}
        </View>
        <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${likeCount} likes`} onPress={() => { hapticSelect(); onLove(); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Heart size={22} color={loved ? "#F0CF69" : "#fff"} weight={loved ? "fill" : "regular"} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#fff" }}>{likeCount}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${commentCount} comments`} onPress={() => { hapticSelect(); onComments(); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ChatCircle size={22} color="#fff" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#fff" }}>{commentCount}</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function Chip({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: gold ? "rgba(201,162,39,0.28)" : "rgba(255,255,255,0.16)" }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#fff" }}>{label}</Text>
    </View>
  );
}
