import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, Skeleton } from "@/components/unmask-ui";
import { Play, UsersThree, BellRinging, ChatCircleDots } from "@/components/icons";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { Avatar } from "@/components/unmask-ui/Avatar";
import { db } from "@/lib/clarity/api";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";

type Session = {
  id: string;
  mode: "live" | "room";
  title: string;
  description: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  host_creator_id: string | null;
  metadata: any;
  creator: { display_name: string; handle: string; avatar_url: string | null; creator_mark: string; verification_level?: string } | null;
};

export default function Live() {
  const router = useRouter();
  const uid = useAppStore(s => s.profile?.id);
  const [rows, setRows] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await db()
        .from("unmask_realtime_sessions")
        .select("id,mode,title,description,status,scheduled_at,started_at,host_creator_id,metadata,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)")
        .in("mode", ["live", "room"])
        .in("status", ["scheduled", "live"])
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(30);
      if (queryError) throw queryError;
      const mapped = (data || []).map((row: any) => ({
        ...row,
        creator: Array.isArray(row.unmask_creators) ? row.unmask_creators[0] || null : row.unmask_creators || null,
      })) as Session[];
      mapped.sort((a, b) => {
        const aLive = a.status === "live" ? 1 : 0;
        const bLive = b.status === "live" ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        const aMine = uid && a.host_creator_id === uid ? 1 : 0;
        const bMine = uid && b.host_creator_id === uid ? 1 : 0;
        return bMine - aMine;
      });
      setRows(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Live right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const openSession = (session: Session) => {
    const isHost = !!uid && session.host_creator_id === uid;
    router.push({
      pathname: session.mode === "room" ? "/room/session" : "/live/session",
      params: { id: session.id, ...(isHost ? { host: "1" } : {}) },
    } as Href);
  };

  return (
    <AppShell back title="Live" subtitle="Discover what the Unmask community is investigating." scroll={false}>
      <View style={{ flex: 1, gap: 15 }}>
        <View style={{ padding: 21, borderRadius: 25, backgroundColor: "#2A0E16", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2, color: "#F2D25B" }}>UNMASK LIVE</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#EE8C7C" }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#E9D8E0" }}>UPDATING LIVE</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 27, lineHeight: 32, color: "#fff" }}>Watch the investigation unfold.</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: "#E9D8E0" }}>Drop into creator broadcasts, ask questions, and follow product conversations as they happen.</Text>
          <Pressable onPress={() => router.push("/creator-studio" as Href)} style={{ alignSelf: "flex-start", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F2D25B" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#2A0E16" }}>Go live</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: colors.ink }}>For you · Live now</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>Swipe through broadcasts and join any stream.</Text>
          </View>
          <Pressable onPress={() => { setRefreshing(true); void load(); }} accessibilityRole="button" style={{ padding: 9 }}>
            {refreshing ? <ActivityIndicator size="small" color={colors.brandDeep} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.brandDeep }}>Refresh</Text>}
          </Pressable>
        </View>

        {loading ? <Skeleton height={460} /> : error ? (
          <View style={{ padding: 18, borderRadius: 20, backgroundColor: "#FFF3F0", gap: 10 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Live could not load</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{error}</Text>
            <ActionButton label="Try again" onPress={() => void load()} />
          </View>
        ) : rows.length ? (
          <ScrollView
            nestedScrollEnabled
            snapToInterval={540}
            decelerationRate="fast"
            snapToAlignment="start"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          >
            {rows.map((session) => {
              const isHost = !!uid && session.host_creator_id === uid;
              const live = session.status === "live";
              const count = Number(session.metadata?.participant_count || 0);
              const creator = session.creator;
              const isRoom = session.mode === "room";
              return (
                <Pressable key={session.id} onPress={() => openSession(session)} accessibilityRole="button" style={({ pressed }) => ({
                  height: 526, borderRadius: 26, overflow: "hidden", backgroundColor: "#16080D", padding: 20, justifyContent: "space-between", opacity: pressed ? 0.94 : 1,
                })}>
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isRoom ? "#30202A" : "#2A0E16" }} />
                  <View style={{ position: "absolute", width: 270, height: 270, borderRadius: 150, backgroundColor: "#512638", top: 70, right: -95, opacity: 0.65 }} />
                  <View style={{ position: "absolute", width: 210, height: 210, borderRadius: 110, borderWidth: 1, borderColor: "#805365", bottom: 70, left: -90, opacity: 0.55 }} />
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: live ? "#B42318" : "#5A3A48", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: "#fff" }} />
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: "#fff", letterSpacing: 0.8 }}>{live ? "LIVE NOW" : "SCHEDULED"}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#E9D8E0" }}>{isRoom ? "AUDIO ROOM" : "CREATOR BROADCAST"}</Text>
                  </View>

                  <View style={{ alignItems: "center", justifyContent: "center", gap: 13, flex: 1 }}>
                    <View style={{ width: 112, height: 112, borderRadius: 60, borderWidth: 2, borderColor: "#F2D25B", alignItems: "center", justifyContent: "center", backgroundColor: "#3A1622" }}>
                      {creator?.avatar_url ? <Avatar name={creator.display_name} uri={creator.avatar_url} size={100} /> : <CreatorMark mark={creator?.creator_mark || session.host_creator_id || session.id} size={88} />}
                    </View>
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#F2D25B" }}>{creator?.display_name || "Unmask Creator"}{creator?.verification_level ? " · Creator" : ""}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: "#E9D8E0" }}>@{creator?.handle || "unmask-creator"}</Text>
                    </View>
                    <Text numberOfLines={3} style={{ fontFamily: fonts.semibold, fontSize: 25, lineHeight: 31, color: "#fff", textAlign: "center" }}>{session.title}</Text>
                    {session.description ? <Text numberOfLines={3} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: "#E9D8E0", textAlign: "center" }}>{session.description}</Text> : null}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <UsersThree size={16} color="#E9D8E0" />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#E9D8E0" }}>{live ? `${count} watching` : session.scheduled_at ? new Date(session.scheduled_at).toLocaleString() : "Coming up"}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 999, backgroundColor: "#F2D25B" }}>
                      <Play size={14} color="#2A0E16" weight="fill" />
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#2A0E16" }}>{isHost ? "Resume" : live ? (isRoom ? "Join room" : "Watch live") : "View details"}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ padding: 22, borderRadius: 23, backgroundColor: "#F6F3F1", gap: 10 }}>
            <BellRinging size={25} color={colors.brandDeep} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: colors.ink }}>No creators are live yet.</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft }}>When a creator starts broadcasting, their stream will appear here. You can also start a Live if your creator access is active.</Text>
            <ActionButton tone="secondary" label="Explore Ultra" onPress={() => router.push("/ultra-unmask" as Href)} />
          </View>
        )}

        <Pressable onPress={() => router.push("/room" as Href)} style={{ padding: 17, borderRadius: 20, borderWidth: 1, borderColor: "#EDE6E1", backgroundColor: "#fff", flexDirection: "row", gap: 12, alignItems: "center" }}>
          <ChatCircleDots size={22} color={colors.brandDeep} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Prefer a discussion?</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>Open Rooms for creator-led conversations.</Text>
          </View>
        </Pressable>
      </View>
    </AppShell>
  );
}
