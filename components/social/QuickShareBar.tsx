import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { Camera } from "@/components/icons";
import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { fonts, livelyRadii } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import * as profiles from "@/lib/profiles/api";
import { useRoomTone } from "@/lib/social/roomTone";
import { useAppStore } from "@/lib/store";

export function QuickShareBar() {
  const router = useRouter();
  const tone = useRoomTone();
  const uid = useAppStore((s) => s.profile?.id);
  const name = useAppStore((s) => s.profile?.displayName) || "You";
  const identity = useQuery({
    queryKey: ["public-identity", uid, "quick-share"],
    queryFn: () => profiles.identity(uid!),
    enabled: !!uid,
    staleTime: 60_000,
  });

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
      <MemberAvatar name={name} uri={identity.data?.avatar_url} size={36} />
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