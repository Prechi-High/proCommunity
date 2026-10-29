import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { db } from "@/lib/clarity/api";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { Avatar } from "@/components/unmask-ui/Avatar";
import { colors, fonts } from "@/constants/theme";
import { ChatCircleDots, Play, UsersThree, X } from "@/components/icons";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";

function ActivityBars({ active, dark }: { active: boolean; dark: boolean }) {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setPulse(v => (v + 1) % 2), 260);
    return () => clearInterval(timer);
  }, [active]);
  const heights = active
    ? (pulse ? [8, 22, 13, 27, 11] : [20, 11, 25, 14, 21])
    : [5, 5, 5, 5, 5];
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 25 }}>
      {heights.map((height, index) => (
        <View key={index} style={{ width: 3, height, borderRadius: 3, backgroundColor: active ? "#F2D25B" : (dark ? "#6C3A4B" : "#C8AAB6") }} />
      ))}
    </View>
  );
}

type Row = {
  id: string;
  mode: "live" | "room";
  title: string;
  description: string;
  host_creator_id: string | null;
  started_at: string | null;
  participant_count: number;
  cohost_ids: string[];
  active_speaker_count: number;
  last_activity_at: string | null;
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
    .select("id,mode,title,description,host_creator_id,started_at,metadata,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)")
    .eq("status", "live")
    .in("mode", ["live", "room"])
    .order("started_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    participant_count: Number(row.metadata?.participant_count || 0),
    cohost_ids: Array.isArray(row.metadata?.cohost_ids) ? row.metadata.cohost_ids.map(String) : [],
    active_speaker_count: Number(row.metadata?.active_speaker_count || 0),
    last_activity_at: row.metadata?.last_activity_at || null,
    creator: Array.isArray(row.unmask_creators) ? row.unmask_creators[0] || null : row.unmask_creators || null,
  })) as Row[];
}

export function RealtimeRail() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore(s => s.profile?.id);
  const q = useQuery({ queryKey: ["active-realtime"], queryFn: loadActive, refetchInterval: 3000 });
  const rows = q.data || [];

  async function endSession(id: string) {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return;
    const response = await fetch("/api/realtime/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ action: "end", sessionId: id }),
    });
    if (!response.ok) return;
    await qc.invalidateQueries({ queryKey: ["active-realtime"] });
  }

  if (!rows.length) return null;

  return (
    <View style={{ gap: 11, marginHorizontal: -20, paddingTop: 3 }}>
      <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: "#EE8C7C" }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.7, color: colors.ink }}>LIVE NOW</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>Listen in</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {rows.map((row) => {
          const creator = row.creator;
          const isRoom = row.mode === "room";
          const isHost = !!uid && row.host_creator_id === uid;
          const label = isHost ? `You're hosting · ${row.participant_count} ${row.participant_count === 1 ? "person" : "people"} here` : isRoom ? "Listen live" : "Watch live";
          const activityActive = row.active_speaker_count > 0 && !!row.last_activity_at && Date.now() - Date.parse(row.last_activity_at) < 6000;
          return (
            <View key={row.id} style={{ width: 292, minHeight: 150, borderRadius: 22, backgroundColor: isRoom ? "#F3EBE2" : "#2A0E16", overflow: "hidden" }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: isRoom ? "/room/session" : "/live/session", params: { id: row.id, ...(isHost ? { host: "1" } : {}) } } as Href)}
                style={({ pressed }) => ({ padding: 16, opacity: pressed ? 0.86 : 1, gap: 10 })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <View style={{ position: "relative" }}>
                    <Avatar name={creator?.display_name || "Unmask Creator"} uri={creator?.avatar_url || undefined} size={44} />
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {isRoom ? <ChatCircleDots size={15} color={colors.brandDeep} /> : <Play size={15} color="#F2D25B" weight="fill" />}
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: isRoom ? colors.brandDeep : "#F2D25B" }}>{label}</Text>
                  <ActivityBars active={activityActive} dark={!isRoom} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <UsersThree size={14} color={isRoom ? colors.inkSoft : "#E9D8E0"} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: isRoom ? colors.inkSoft : "#E9D8E0" }}>{row.participant_count} {row.participant_count === 1 ? "person" : "people"} here</Text>
                  {activityActive ? <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: isRoom ? colors.brandDeep : "#F2D25B" }}>LIVE TALKING</Text> : null}
                </View>
              </Pressable>
              {isHost ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: isRoom ? colors.inkSoft : "#E9D8E0", flex: 1 }}>Your session is still live.</Text>
                  <Pressable accessibilityRole="button" onPress={() => void endSession(row.id)} style={{ minHeight: 34, paddingHorizontal: 11, borderRadius: 11, backgroundColor: isRoom ? "#fff" : "#3A1622", flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <X size={14} color={isRoom ? colors.brandDeep : "#F2D25B"} />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: isRoom ? colors.brandDeep : "#F2D25B" }}>End</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
