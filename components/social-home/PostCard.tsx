import { Image, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { sampleMark, type Expression } from "@/lib/social/model";
import { useMovementPalette } from "@/components/movement/palette";

import { Face, portraitSource } from "./media";

export function PostCard({
  post,
  width,
}: {
  post: Expression;
  width?: number;
}) {
  const palette = useMovementPalette();
  const router = useRouter();
  const mark = sampleMark(post);
  const openPerson = () => {
    hapticSelect();
    router.push(`/member/${post.authorId}` as Href);
  };
  const openAttach = () => {
    if (!post.attach) return;
    hapticSelect();
    if (post.sample || post.attach.kind === "card") {
      router.push(`/member/${post.authorId}` as Href);
      return;
    }
    if (post.attach.kind === "timeline") router.push(`/journey/${post.attach.id}` as Href);
    else router.push(`/products/item/${post.attach.id}` as Href);
  };
  return (
    <View style={{ width, gap: 12 }}>
      <View style={{ width: "100%", aspectRatio: 4 / 5, borderRadius: 28, overflow: "hidden", backgroundColor: palette.quiet }}>
        <Image
          source={portraitSource(post.media)}
          accessibilityLabel={mark ? `Sample photo from ${post.author}` : `Photo from ${post.author}`}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          style={{ width: "100%", height: "100%", objectFit: "cover" as const, objectPosition: "center 18%" } as object}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`${post.author} profile`} onPress={openPerson}>
          <Face source={post.avatar} name={post.author} size={36} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: palette.ink }}>{post.author}</Text>
          {mark ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: palette.gold }}>Sample</Text> : null}
        </View>
      </View>
      {post.caption ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: palette.ink, paddingHorizontal: 4 }}>
          {post.caption}
        </Text>
      ) : null}
      {post.attach ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.attach.label}
          onPress={openAttach}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            marginHorizontal: 4,
            minHeight: 40,
            paddingHorizontal: 14,
            borderRadius: 999,
            justifyContent: "center",
            backgroundColor: pressed ? palette.quiet : palette.card,
            borderWidth: 1,
            borderColor: palette.line,
          })}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: palette.wine }}>{post.attach.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
