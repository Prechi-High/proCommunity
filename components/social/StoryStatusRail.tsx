import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import { Plus } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { useLocalAvatar } from "@/lib/profile/localAvatar";
import * as profiles from "@/lib/profiles/api";
import { PREVIEW_MOMENTS, STORY_FACES, type PulseMoment } from "@/lib/social/previewMoments";
import { previewStoriesForPerson } from "@/lib/social/personStories";
import { CREATE_UNMASK_GLOW, CREATE_UNMASK_RING, storyMetaFor } from "@/lib/social/storyRail";
import { useRoomTone } from "@/lib/social/roomTone";
import { useAppStore } from "@/lib/store";

import { StoryViewer } from "./StoryViewer";

export function StoryStatusRail({ onQueueChange }: { onQueueChange?: (open: boolean) => void }) {
  const router = useRouter();
  const tone = useRoomTone();
  const stories = useLocalMoments((s) => s.stories);
  const pruneStories = useLocalMoments((s) => s.pruneStories);
  const uid = useAppStore((s) => s.profile?.id);
  const name = useAppStore((s) => s.profile?.displayName)?.split(" ")[0] || "You";
  const localAvatar = useLocalAvatar((s) => s.uri);
  const identity = useQuery({
    queryKey: ["public-identity", uid, "story-rail"],
    queryFn: () => profiles.identity(uid!),
    enabled: !!uid,
    staleTime: 60_000,
  });
  const avatarUrl = localAvatar || identity.data?.avatar_url || "";
  const [storyQueue, setStoryQueue] = useState<PulseMoment[]>([]);

  useEffect(() => {
    pruneStories();
  }, [pruneStories]);

  const myStories = useMemo(() => {
    const now = Date.now();
    return stories.filter((s) => new Date(s.expiresAt).getTime() > now);
  }, [stories]);
  const ringThumb = myStories[0]?.media;

  const goPost = () => {
    hapticSelect();
    router.push("/moment" as Href);
  };

  const myStoryQueue = (): PulseMoment[] =>
    myStories.map((s) => ({
      id: s.id,
      name,
      face: avatarUrl,
      media: s.mediaKind === "video" ? "" : s.media,
      video: s.mediaKind === "video" ? s.media : undefined,
      caption: s.caption || "Your story.",
      likes: s.likes,
      comments: 0,
      thread: [],
      invite: "Your story.",
      storyId: s.id,
    }));

  const openStories = (startId: string) => {
    hapticSelect();
    setStoryQueue(previewStoriesForPerson(startId));
    onQueueChange?.(true);
  };

  const openMine = () => {
    if (!myStories.length) {
      goPost();
      return;
    }
    hapticSelect();
    setStoryQueue(myStoryQueue());
    onQueueChange?.(true);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 4 }}>
        <View style={{ width: 82, alignItems: "center", gap: 8 }}>
          <View style={{ position: "absolute", top: 8, width: 72, height: 72, borderRadius: 36, backgroundColor: CREATE_UNMASK_GLOW, opacity: 0.85 }} />
          <Pressable onPress={openMine} accessibilityRole="button" accessibilityLabel={ringThumb ? "View your story" : "Create your Unmask"}>
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
            <Pressable accessibilityLabel="Add another story" onPress={goPost} style={{ position: "absolute", right: 4, top: 50, width: 24, height: 24, borderRadius: 12, backgroundColor: "#FF6B9D", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1A0A14" }}>
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
            <Pressable key={face.id} accessibilityRole="button" onPress={() => openStories(face.id)} style={{ width: 82, alignItems: "center", gap: 8 }}>
              <View style={{ position: "absolute", top: 8, width: 72, height: 72, borderRadius: 36, backgroundColor: meta.glow }} />
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
      <StoryViewer
        visible={storyQueue.length > 0}
        queue={storyQueue}
        onClose={() => {
          setStoryQueue([]);
          onQueueChange?.(false);
        }}
        interactive
      />
    </>
  );
}