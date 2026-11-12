import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMovementPalette } from "@/components/movement/palette";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { CINEMATIC_AT, PHONE_FRAME } from "@/lib/movement/frame";
import { SOCIAL_IDENTITY } from "@/lib/social/identity";

import { MovementChip } from "./MovementChip";
import { PostCard } from "./PostCard";
import { StoryRail } from "./StoryRail";
import { StoryViewer } from "./StoryViewer";
import { useSocialBoard } from "./useBoard";

export function CommunitySocial() {
  const board = useSocialBoard();
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();
  return (
    <View style={{ gap: 18, paddingTop: 6 }}>
      <StoryRail
        people={board.people}
        samples={board.storySamples}
        seen={board.seen}
        onOpen={setOpen}
        onAdd={() => router.push("/moment/new" as Href)}
      />
      <PostStrip posts={board.posts} samples={board.postSamples} />
      {board.error ? (
        <Text style={{ paddingHorizontal: 20, fontFamily: fonts.regular, fontSize: 13, color: "#7A4B00" }}>
          Live stories couldn’t load. Samples stay labeled.
        </Text>
      ) : null}
      <StoryModal people={board.people} startId={open} onSeen={board.mark} onClose={() => setOpen(null)} />
    </View>
  );
}

export function SocialDoor({ mode }: { mode: "guest" | "member" }) {
  const palette = useMovementPalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= CINEMATIC_AT;
  const board = useSocialBoard();
  const [open, setOpen] = useState<string | null>(null);
  const started = () => {
    hapticSelect();
    router.push("/sign-up" as Href);
  };
  const body = (
    <View style={{ width: "100%", maxWidth: wide ? 1120 : PHONE_FRAME, alignSelf: "center", gap: 18, paddingBottom: 28 }}>
      {mode === "guest" ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.6, color: palette.wine }}>Unmask</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable accessibilityRole="link" accessibilityLabel="Sign in" onPress={() => router.push("/(auth)/sign-in" as Href)} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: palette.ink }}>Sign in</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get Started"
              onPress={started}
              style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: palette.button, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.buttonText }}>Get Started</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 20 }}>
        <MovementChip />
      </View>
      <StoryRail
        people={board.people}
        samples={board.storySamples}
        seen={board.seen}
        onOpen={setOpen}
        onAdd={() => router.push(mode === "guest" ? ({ pathname: "/sign-up", params: { returnTo: "/moment/new" } } as Href) : ("/moment/new" as Href))}
      />
      <View style={{ paddingHorizontal: 20, gap: 4 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: palette.ink }}>{SOCIAL_IDENTITY.habitLine}</Text>
        {mode === "guest" ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Show us your Unmask" onPress={started}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.wine }}>Show us your Unmask</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Post a photo" onPress={() => router.push("/post/new" as Href)}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.wine }}>Show your Unmask</Text>
          </Pressable>
        )}
      </View>
      <PostStrip posts={board.posts} samples={board.postSamples} wide={wide} />
      <View style={{ paddingHorizontal: 20, flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Find a product" onPress={() => router.push("/results" as Href)}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>Find a product</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Start with one product"
          onPress={() =>
            router.push(
              mode === "guest"
                ? ({ pathname: "/sign-up", params: { returnTo: "/products/add" } } as Href)
                : ("/products/add" as Href),
            )
          }
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>Start with one product</Text>
        </Pressable>
      </View>
      {board.error ? (
        <Text style={{ paddingHorizontal: 20, fontFamily: fonts.regular, fontSize: 13, color: palette.gold }}>
          Live stories couldn’t load. Samples stay labeled.
        </Text>
      ) : null}
      <StoryModal people={board.people} startId={open} onSeen={board.mark} onClose={() => setOpen(null)} />
    </View>
  );
  if (mode === "member") return body;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.page }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

function PostStrip({
  posts,
  samples,
  wide = false,
}: {
  posts: ReturnType<typeof useSocialBoard>["posts"];
  samples: boolean;
  wide?: boolean;
}) {
  const palette = useMovementPalette();
  const { width } = useWindowDimensions();
  const column = Math.min(width, wide ? 1120 : PHONE_FRAME);
  const hero = posts[0];
  const rest = posts.slice(1);
  if (!hero) return null;
  return (
    <View style={{ gap: 18 }}>
      {samples ? (
        <Text style={{ paddingHorizontal: 20, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4, color: palette.gold }}>
          SAMPLE POSTS · IMAGINED
        </Text>
      ) : null}
      <View style={{ paddingHorizontal: 16 }}>
        <PostCard post={hero} />
      </View>
      {rest.length ? (
        wide ? (
          <View style={{ paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {rest.map((post) => (
              <View key={post.id} style={{ width: (column - 48) / 2 }}>
                <PostCard post={post} />
              </View>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingRight: 36 }}>
            {rest.map((post) => (
              <PostCard key={post.id} post={post} width={Math.round(column * 0.78)} />
            ))}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

function StoryModal({
  people,
  startId,
  onSeen,
  onClose,
}: {
  people: ReturnType<typeof useSocialBoard>["people"];
  startId: string | null;
  onSeen: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!startId} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {startId ? <StoryViewer people={people} startId={startId} onSeen={onSeen} onClose={onClose} /> : null}
    </Modal>
  );
}
