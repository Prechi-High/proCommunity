import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { db } from "@/lib/clarity/api";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { Avatar } from "@/components/unmask-ui/Avatar";
import { colors, fonts } from "@/constants/theme";
import { ChatCircleDots, Play, UsersThree } from "@/components/icons";

type Row = {
  id: string;
  mode: "live" | "room";
  title: string;
  description: string;
  host_creator_id: string | null;
  started_at: string | null;
  creator?: {
    display_name: string;
    handle: string;
    avatar_url: string | null;
    creator_mark: string;
    verification_level: string;
  } | null;
};

async function loadActive() {
  const { data, error } = await db()
    .from("unmask_realtime_sessions")
    .select("id,mode,title,description,host_creator_id,started_at,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)")
    .eq("status", "live")
    .in("mode", ["live", "room"])
    .order("started_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    creator: Array.isArray(row.unmask_creators) ? row.unmask_creators[0] || null : row.unmask_creators || null,
  })) as Row[];
}

export function RealtimeRail() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["active-realtime"],
    queryFn: loadActive,
    refetchInterval: 10000,
  });
  const rows = q.data || [];
  if (!rows.length) return null;

  return (
    <View style={{ gap: 11, marginHorizontal: -20, paddingTop: 3 }}>
      <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: "#EE8C7C" }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.7, color: colors.ink }}>LIVE NOW</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>Tap to listen</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {rows.map((row) => {
          const creator = row.creator;
          const isRoom = row.mode === "room";
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: isRoom ? "/room/session" : "/live/session", params: { id: row.id } } as Href)}
              style={({ pressed }) => ({
                width: 280,
                minHeight: 138,
                padding: 16,
                borderRadius: 22,
                backgroundColor: isRoom ? "#F3EBE2" : "#2A0E16",
                opacity: pressed ? 0.86 : 1,
                gap: 11,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <View style={{ position: "relative" }}>
                  <Avatar uri={creator?.avatar_url || undefined} size={44} />
                  <View style={{ position: "absolute", right: -4, bottom: -4, borderRadius: 12, backgroundColor: isRoom ? "#F3EBE2" : "#2A0E16", padding: 2 }}>
                    <CreatorMark mark={creator?.creator_mark || row.host_creator_id || row.id} size={20} />
                  </View>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: isRoom ? colors.ink : "#fff" }}>
                    {creator?.display_name || "Unmask Creator"}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: isRoom ? colors.inkSoft : "#E9D8E0" }}>
                    @{creator?.handle || "creator"} · {isRoom ? "Room" : "Live"}
                  </Text>
                </View>
                <CreatorMark mark={creator?.creator_mark || row.host_creator_id || row.id} size={27} />
              </View>
              <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 21, color: isRoom ? colors.ink : "#fff" }}>
                {row.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                {isRoom ? <ChatCircleDots size={15} color={colors.brandDeep} /> : <Play size={15} color="#F2D25B" weight="fill" />}
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: isRoom ? colors.brandDeep : "#F2D25B" }}>
                  {isRoom ? "Listen live" : "Watch live"}
                </Text>
                <UsersThree size={14} color={isRoom ? colors.inkSoft : "#E9D8E0"} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
