import { Image, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Camera } from "@/components/icons";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { useRoomTone } from "@/lib/social/roomTone";
import { useAppStore } from "@/lib/store";

export function QuickShareBar() {
  const router = useRouter();
  const tone = useRoomTone();
  const storyPhoto = useLocalMoments((s) => s.storyPhoto);
  const name = useAppStore((s) => s.profile?.displayName) || "You";
  const initial = name.slice(0, 1).toUpperCase();

  const open = () => {
    hapticSelect();
    router.push("/moment" as Href);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share your Unmask"
      onPress={open}
      style={{
        marginHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: livelyRadii.card,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      {storyPhoto ? (
        <Image source={{ uri: storyPhoto }} style={{ width: 36, height: 36, borderRadius: 18 }} accessibilityIgnoresInvertColors />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#70323E",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "#FFF8F4" }}>{initial}</Text>
        </View>
      )}
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: tone.faint }}>Share your Unmask…</Text>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: "rgba(255,107,157,0.22)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Camera size={22} color="#FF8BC8" weight="fill" />
      </View>
    </Pressable>
  );
}
