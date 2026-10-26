import { useRef, useState } from "react";
import { Share, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  ChatCircle,
  PaperPlaneRight,
  Lightning,
} from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import { hapticSelect, hapticSaved, hapticError } from "@/lib/haptics";
import type { FeedItem } from "@/lib/unmask/feed";
import * as social from "@/lib/unmask/social";
import { ReactionButton } from "./ReactionButton";
import { PostComments } from "./PostComments";
import { SparkSheet } from "./SparkSheet";
export function PostActions({ item }: { item: FeedItem }) {
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const demoLiked = useAppStore((s) => !!s.demoLikes[item.id]);
  const toggleDemo = useAppStore((s) => s.toggleDemoLike);
  const target =
    item.kind === "unmask" ? social.postId(item.href) : item.sparkTargetId;
  const demoAdded = useAppStore((s) =>
    target ? (s.demoSparkAdds[target] ?? 0) : 0,
  );
  const addDemo = useAppStore((s) => s.addDemoSparks);
  const [comments, setComments] = useState(false);
  const [spark, setSpark] = useState(false);
  const [likePulse, setLikePulse] = useState(0);
  const [sparkPulse, setSparkPulse] = useState(0);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [notice, setNotice] = useState("");
  const id = social.postId(item.href);
  const key = ["post-stats", item.kind, id, uid];
  const stats = useQuery({
    queryKey: key,
    queryFn: () => social.postStats(item.kind, id),
    enabled: !item.sample,
    staleTime: 30000,
  });
  const liked = item.sample ? demoLiked : (stats.data?.liked ?? false);
  const likeCount = item.sample
    ? (item.likes ?? 0) + (liked ? 1 : 0)
    : stats.data?.likes;
  const count = item.sample ? (item.replies ?? 0) : stats.data?.comments;
  async function like() {
    if (lock.current) return;
    setNotice("");
    if (item.sample) {
      toggleDemo(item.id);
      hapticSelect();
      if (!liked) setLikePulse((x) => x + 1);
      return;
    }
    if (!uid) {
      r.push({
        pathname: "/(auth)/sign-in",
        params: { returnTo: item.href },
      } as Href);
      return;
    }
    if (stats.isError || !stats.data) {
      void stats.refetch();
      setNotice("Refreshing reactions. Please try again.");
      return;
    }
    lock.current = true;
    setPending(true);
    const before = stats.data;
    const next = !liked;
    qc.setQueryData(key, {
      ...before,
      liked: next,
      likes: Math.max(0, before.likes + (next ? 1 : -1)),
    });
    hapticSelect();
    try {
      await social.setPostLike(item.kind, id, next);
      if (next) setLikePulse((x) => x + 1);
    } catch {
      qc.setQueryData(key, before);
      setNotice("Your like couldn’t be saved. Try again.");
      hapticError();
    } finally {
      lock.current = false;
      setPending(false);
      void qc.invalidateQueries({ queryKey: ["post-stats", item.kind, id] });
    }
  }
  function addSpark() {
    setNotice("");
    if (item.sample) {
      const demoTarget = target || "sample-unmask-1";
      addDemo(demoTarget, 10);
      setSparkPulse((x) => x + 1);
      hapticSaved(`demo-${Date.now()}`);
      setNotice("10 demo Sparks added. No wallet charged.");
      return;
    }
    if (target) {
      setSpark(true);
    } else {
      r.push({
        pathname: "/investigation/request",
        params: {
          product: item.productId ?? "",
          q: item.title,
          ...(item.kind === "experience"
            ? { experience: id }
            : { question: id }),
        },
      } as Href);
    }
  }
  async function share() {
    setNotice("");
    try {
      const result = await Share.share({
        message: `${item.sample ? "Demo story · " : ""}${item.title}\n${Linking.createURL(item.href)}`,
      });
      if (result.action === Share.sharedAction) hapticSelect();
    } catch {
      setNotice("Sharing couldn’t open. Try again.");
    }
  }
  return (
    <>
      <View
        style={{
          marginHorizontal: 14,
          borderTopWidth: 1,
          borderTopColor: "#F0EAE6",
          paddingVertical: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 0 }}>
          <ReactionButton
            Icon={Heart}
            label={`${liked ? "Unlike" : "Like"} post${likeCount !== undefined ? `, ${likeCount} likes` : ""}`}
            count={likeCount ?? "—"}
            active={liked}
            color="#B53553"
            pulse={likePulse}
            disabled={pending}
            onPress={() => void like()}
          />
          <ReactionButton
            Icon={ChatCircle}
            label={`Open comments${count !== undefined ? `, ${count} comments` : ""}`}
            count={count ?? "—"}
            onPress={() => {
              hapticSelect();
              setComments(true);
            }}
          />
          <ReactionButton
            Icon={PaperPlaneRight}
            label="Share post"
            onPress={() => void share()}
          />
        </View>
        <ReactionButton
          Icon={Lightning}
          label={
            target || item.sample
              ? `Add Sparks${item.sample ? " · demo" : ""}`
              : "Take this story further"
          }
          count={
            target || item.sample ? (item.sparks ?? 0) + demoAdded : "Unmask"
          }
          active={!!item.sample && demoAdded > 0}
          color="#976413"
          pulse={sparkPulse}
          onPress={addSpark}
        />
      </View>
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontFamily: fonts.medium,
            fontSize: 12,
            lineHeight: 18,
            color: colors.brand,
            paddingHorizontal: 20,
            paddingBottom: 12,
          }}
        >
          {notice}
        </Text>
      ) : null}
      <PostComments
        item={item}
        open={comments}
        onClose={() => setComments(false)}
      />
      {target && !item.sample ? (
        <SparkSheet
          open={spark}
          onClose={() => setSpark(false)}
          investigationId={target}
        />
      ) : null}
    </>
  );
}
