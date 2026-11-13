import { useState } from "react";
import { Image, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { ActionButton, AppShell, StatusMessage } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { PREVIEW_MOMENTS, type PulseComment } from "@/lib/social/previewMoments";
import { useRoomTone } from "@/lib/social/roomTone";
import { useAppStore } from "@/lib/store";
import { LoopClip } from "@/components/social/LoopClip";

export default function PulsePost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tone = useRoomTone();
  const mine = useLocalMoments((s) => s.posts);
  const name = useAppStore((s) => s.profile?.displayName)?.split(" ")[0] || "You";
  const local = mine.find((post) => post.id === id);
  const preview = PREVIEW_MOMENTS.find((post) => post.id === id);
  const [extra, setExtra] = useState<PulseComment[]>([]);
  const [draft, setDraft] = useState("");
  const [joined, setJoined] = useState(false);

  if (!local && !preview) {
    return (
      <AppShell back title="This post">
        <StatusMessage title="That post is not in this room." />
      </AppShell>
    );
  }

  const author = local ? name : preview!.name;
  const caption = local?.caption || preview?.caption || "";
  const media = local?.photo || preview?.media || "";
  const video = local?.mediaKind === "video" ? local.photo : preview?.video;
  const thread = [...(preview?.thread ?? []), ...extra];
  const skin = local?.skin || preview?.skin;
  const product = local?.productName || preview?.product;
  const timeline = local?.timelineLabel || preview?.timeline;

  return (
    <AppShell back title={author} subtitle="The post, then the conversation.">
      <View style={{ gap: 14 }}>
        {video && !local ? (
          <LoopClip uri={video} poster={media} height={420} />
        ) : local?.mediaKind === "video" && local.photo ? (
          <LoopClip uri={local.photo} poster={local.photo} height={420} />
        ) : media ? (
          <Image source={{ uri: media }} style={{ width: "100%", height: 420, borderRadius: 24 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: tone.text }}>{caption}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: tone.muted }}>
          {[skin ? `Skin · ${skin}` : "", product || "", timeline || ""].filter(Boolean).join("  ·  ")}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: tone.text }}>Comments</Text>
        {thread.length ? (
          thread.map((row, index) => (
            <View key={`${row.name}-${index}`} style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: tone.text }}>{row.name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: tone.muted }}>{row.text}</Text>
            </View>
          ))
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: tone.muted }}>No comments yet.</Text>
        )}
        {joined ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add your comment"
              placeholderTextColor={tone.faint}
              style={{ minHeight: 72, color: tone.text, fontFamily: fonts.regular, fontSize: 16 }}
            />
            <ActionButton
              label="Send"
              onPress={() => {
                if (draft.trim().length < 1) return;
                setExtra((rows) => [...rows, { name, text: draft.trim() }]);
                setDraft("");
              }}
            />
          </View>
        ) : (
          <ActionButton label="Join the conversation" onPress={() => setJoined(true)} />
        )}
      </View>
    </AppShell>
  );
}
