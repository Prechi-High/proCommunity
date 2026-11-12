import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { Heart, Plus } from "@/components/icons";
import { colors, fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { PREVIEW_MOMENTS, STORY_FACES, type PulseMoment } from "@/lib/social/previewMoments";
import { useAppStore } from "@/lib/store";

import { LoopClip } from "./LoopClip";

export function LivingFeed({ guest }: { guest?: boolean }) {
  const router = useRouter();
  const mine = useLocalMoments((s) => s.posts);
  const name = useAppStore((s) => s.profile?.displayName)?.split(" ")[0] || "You";
  const [loved, setLoved] = useState<Record<string, boolean>>({});

  const yours: PulseMoment[] = mine.map((post) => ({
    id: post.id,
    name,
    face: "",
    media: post.photo || "",
    caption: post.caption || "A moment, no essay.",
    product: post.productName,
    invite: "This one is yours.",
  }));

  const goPost = () => {
    hapticSelect();
    router.push("/moment" as Href);
  };

  return (
    <View style={{ gap: 18 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingTop: 4 }}
      >
        <Pressable onPress={goPost} accessibilityRole="button" accessibilityLabel="Add your moment" style={{ width: 74, alignItems: "center", gap: 6 }}>
          <LinearGradient colors={["#F0CF69", "#70323E"]} style={{ width: 68, height: 68, borderRadius: 24, padding: 3 }}>
            <View style={{ flex: 1, borderRadius: 21, backgroundColor: "#1A0A14", alignItems: "center", justifyContent: "center" }}>
              <Plus size={26} color="#F0CF69" weight="bold" />
            </View>
          </LinearGradient>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF8F4" }}>You</Text>
        </Pressable>
        {STORY_FACES.map((face) => (
          <Pressable key={face.id} onPress={goPost} style={{ width: 74, alignItems: "center", gap: 6 }}>
            <LinearGradient colors={["#C9A227", "#8E4052", "#3D0F15"]} style={{ width: 68, height: 68, borderRadius: 24, padding: 2 }}>
              <Image source={{ uri: face.face }} style={{ flex: 1, borderRadius: 22 }} accessibilityIgnoresInvertColors />
            </LinearGradient>
            <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,248,244,0.8)" }}>
              {face.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: "rgba(255,248,244,0.55)", paddingHorizontal: 16 }}>
        Preview of the room — photos and a short clip so you can feel the pace. Your post is the one that is actually yours.
      </Text>

      {yours.map((item) => (
        <MomentCard key={item.id} item={item} loved={!!loved[item.id]} onLove={() => setLoved((s) => ({ ...s, [item.id]: !s[item.id] }))} onPost={goPost} />
      ))}

      {PREVIEW_MOMENTS.map((item, index) => (
        <View key={item.id} style={{ gap: 14 }}>
          <MomentCard item={item} loved={!!loved[item.id]} onLove={() => setLoved((s) => ({ ...s, [item.id]: !s[item.id] }))} onPost={goPost} />
          {index % 3 === 2 ? (
            <Nudge
              guest={guest}
              onPost={guest ? () => router.push("/sign-up" as Href) : goPost}
              line={item.invite}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function MomentCard({
  item,
  loved,
  onLove,
  onPost,
}: {
  item: PulseMoment;
  loved: boolean;
  onLove: () => void;
  onPost: () => void;
}) {
  return (
    <View style={{ marginHorizontal: 12, borderRadius: livelyRadii.hero, overflow: "hidden", backgroundColor: "#120810" }}>
      {item.video ? (
        <LoopClip uri={item.video} poster={item.media} height={420} />
      ) : item.media ? (
        <Image source={{ uri: item.media }} style={{ width: "100%", height: 420 }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ height: 280, backgroundColor: "#2D1530" }} />
      )}
      <LinearGradient
        colors={["transparent", "rgba(10,4,8,0.2)", "rgba(10,4,8,0.92)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 8 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {item.face ? (
            <Image source={{ uri: item.face }} style={{ width: 36, height: 36, borderRadius: 18 }} accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#70323E", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontFamily: fonts.bold }}>{item.name.slice(0, 1)}</Text>
            </View>
          )}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#fff", flex: 1 }}>{item.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Love this moment" onPress={() => { hapticSelect(); onLove(); }}>
            <Heart size={26} color={loved ? "#F0CF69" : "#fff"} weight={loved ? "fill" : "regular"} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: "#FFF8F4" }}>{item.caption}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {item.product ? <Chip label={item.product} /> : <Chip label="No product — still a post" />}
          {item.timeline ? <Chip label={item.timeline} /> : null}
        </View>
        <Pressable onPress={onPost} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#F0CF69" }}>{item.invite} · Share yours</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#fff" }}>{label}</Text>
    </View>
  );
}

function Nudge({ line, onPost, guest }: { line: string; onPost: () => void; guest?: boolean }) {
  return (
    <Pressable onPress={onPost} style={{ marginHorizontal: 16 }}>
      <LinearGradient colors={["#3D0F15", "#5C2834"]} style={{ borderRadius: livelyRadii.card, padding: 18, gap: 6 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: "#FFF8F4" }}>{line}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,248,244,0.75)" }}>
          {guest ? "Join and drop one moment. A timeline can come later." : "Camera, gallery, or a sentence. Product optional."}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.gold }}>{guest ? "Get started" : "Share your moment"}</Text>
      </LinearGradient>
    </Pressable>
  );
}
