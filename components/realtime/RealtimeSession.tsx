import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from "livekit-client";
import { db } from "@/lib/clarity/api";
import { supabase } from "@/lib/supabase";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { ChatCircleDots, Play, UsersThree, X } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";

type ChatItem = { id: string; name: string; text: string };
type Creator = { user_id: string; display_name: string; handle: string; avatar_url: string | null; creator_mark: string; status: string; published: boolean };

export function RealtimeSession({
  id,
  mode,
  host,
}: {
  id: string;
  mode: "live" | "room";
  host: boolean;
}) {
  const router = useRouter();
  const uid = useAppStore(s => s.profile?.id);
  const roomRef = useRef<Room | null>(null);
  const mediaRef = useRef<any>(null);
  const [state, setState] = useState("connecting");
  const [count, setCount] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [speaker, setSpeaker] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [title, setTitle] = useState(mode === "live" ? "Live" : "Room");
  const [creator, setCreator] = useState<any>(null);
  const [liveRole, setLiveRole] = useState<"viewer" | "host" | "cohost">("viewer");
  const [isHostSession, setIsHostSession] = useState(host);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [cohostIds, setCohostIds] = useState<string[]>([]);
  const encoder = useMemo(() => new TextEncoder(), []);
  const decoder = useMemo(() => new TextDecoder(), []);

  useEffect(() => {
    if (!speaking) return;
    const timer = setInterval(() => setPulse(v => (v + 1) % 2), 220);
    return () => clearInterval(timer);
  }, [speaking]);

  useEffect(() => {
    if (!id) return;
    let dead = false;
    const attach = (track: RemoteTrack) => {
      if (Platform.OS !== "web" || !mediaRef.current) return;
      const el = track.attach();
      el.setAttribute("data-unmask-track", track.sid || "");
      if (track.kind === Track.Kind.Video) {
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = "cover";
        el.style.borderRadius = "22px";
      } else {
        el.style.display = "none";
      }
      mediaRef.current.appendChild(el);
    };
    const detach = (track: RemoteTrack) => {
      if (Platform.OS !== "web") return;
      track.detach();
    };

    (async () => {
      try {
        if (!supabase) throw new Error("Connection unavailable.");
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session?.access_token) throw new Error("Sign in required.");
        const res = await fetch("/api/realtime/token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
          body: JSON.stringify({ sessionId: id, role: host ? "host" : "cohost" }),
        });
        const raw = await res.text();
        let payload = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch {
          throw new Error(raw.trim() || `Could not join the session (HTTP ${res.status}).`);
        }
        if (!res.ok) throw new Error(payload.error || `Could not join the session (HTTP ${res.status}).`);

        const syncPresence = async (activeSpeakerCount = 0, activeSpeakerName = "") => {
          try {
            const presence = await fetch("/api/realtime/token", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
              body: JSON.stringify({
                action: "sync_presence",
                sessionId: id,
                activeSpeakerCount,
                activeSpeakerName,
              }),
            });
            const result = await presence.json().catch(() => ({}));
            if (presence.ok && typeof result.participantCount === "number") setCount(result.participantCount);
          } catch {}
        };

        setLiveRole(payload.role || "viewer");
        setIsHostSession(payload.role === "host");
        const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
        roomRef.current = room;
        const sync = () => {
          setCount(room.numParticipants + 1);
          void syncPresence(room.activeSpeakers.length, room.activeSpeakers[0]?.name || room.activeSpeakers[0]?.identity || "");
        };
        const onTrack = (track: RemoteTrack) => attach(track);
        const onUntrack = (track: RemoteTrack) => detach(track);
        const onSpeaker = (people: Participant[]) => {
          const first = people[0];
          setSpeaker(first?.name || first?.identity || "");
          setSpeaking(people.length > 0);
          void syncPresence(people.length, first?.name || first?.identity || "");
        };
        const onChat = (payloadBytes: Uint8Array, participant?: Participant) => {
          try {
            const item = JSON.parse(decoder.decode(payloadBytes));
            if (item?.type !== "chat" || !item.text) return;
            setChat(old => [...old, { id: item.id || String(Date.now()), name: participant?.name || participant?.identity || "Unmasker", text: String(item.text) }].slice(-40));
          } catch {}
        };
        room.on(RoomEvent.ParticipantConnected, sync)
          .on(RoomEvent.ParticipantDisconnected, sync)
          .on(RoomEvent.TrackSubscribed, onTrack)
          .on(RoomEvent.TrackUnsubscribed, onUntrack)
          .on(RoomEvent.ActiveSpeakersChanged, onSpeaker)
          .on(RoomEvent.DataReceived, onChat)
          .on(RoomEvent.AudioPlaybackStatusChanged, ok => setCanPlayAudio(ok))
          .on(RoomEvent.Disconnected, () => !dead && setState("ended"));

        await room.connect(payload.serverUrl, payload.participantToken);
        if (dead) return;
        sync();


        const session = await db().from("unmask_realtime_sessions")
          .select("title,host_creator_id,metadata,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)")
          .eq("id", id).single();
        if (!session.error) {
          setTitle(session.data?.title || title);
          const c = Array.isArray(session.data?.unmask_creators) ? session.data?.unmask_creators[0] : session.data?.unmask_creators;
          setCreator(c || null);
          const ids = Array.isArray(session.data?.metadata?.cohost_ids) ? session.data.metadata.cohost_ids.map(String) : [];
          setCohostIds(ids);
        }

        if (payload.role === "host") {
          const { data } = await db().from("unmask_creators")
            .select("user_id,display_name,handle,avatar_url,creator_mark,status,published")
            .eq("published", true)
            .in("status", ["trial", "active", "expert", "verified_professional"])
            .neq("user_id", uid || "");
          setCreators((data || []) as Creator[]);
        }

        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.isSubscribed && publication.track) attach(publication.track as RemoteTrack);
          }
        }

        if (payload.role === "host" || payload.role === "cohost") {
          if (mode === "live") {
            await room.localParticipant.setCameraEnabled(true);
            setCameraOn(true);
          }
          await room.localParticipant.setMicrophoneEnabled(true);
          setMicOn(true);
        }
        setState("connected");
      } catch (e) {
        if (!dead) setState(e instanceof Error ? e.message : "Could not join the session.");
      }
    })();

    return () => {
      dead = true;
      void roomRef.current?.disconnect().then(() => {
        if (supabase) {
          supabase.auth.getSession().then(({ data }) => {
            if (data.session?.access_token) {
              void fetch("/api/realtime/token", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
                body: JSON.stringify({ action: "sync_presence", sessionId: id, activeSpeakerCount: 0, activeSpeakerName: "" }),
              });
            }
          });
        }
      });
      roomRef.current = null;
    };
  }, [id, mode, host, decoder, uid]);

  async function sendMessage() {
    const room = roomRef.current;
    const text = message.trim();
    if (!room || !text) return;
    setMessage("");
    const payload = { type: "chat", id: `${Date.now()}-${Math.random()}`, text };
    await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), { reliable: true, topic: "unmask-chat" });
    setChat(old => [...old, { id: payload.id, name: "You", text }].slice(-40));
  }

  async function toggleMic() {
    const room = roomRef.current; if (!room) return;
    const next = !micOn; await room.localParticipant.setMicrophoneEnabled(next); setMicOn(next);
  }

  async function toggleCamera() {
    const room = roomRef.current; if (!room || mode !== "live" || (liveRole !== "host" && liveRole !== "cohost")) return;
    const next = !cameraOn; await room.localParticipant.setCameraEnabled(next); setCameraOn(next);
  }

  async function startAudio() {
    const room = roomRef.current;
    if (!room) return;
    try { await room.startAudio(); setCanPlayAudio(true); } catch {}
  }

  async function manage(action: "end" | "add_cohost" | "remove_cohost", targetUserId?: string) {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return;
    const response = await fetch("/api/realtime/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ action, sessionId: id, targetUserId }),
    });
    const raw = await response.text();
    let payload: any = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch {
      throw new Error(raw.trim() || `Could not update the session (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(payload.error || `Could not update the session (HTTP ${response.status}).`);
    if (action === "add_cohost") setCohostIds(payload.cohostIds || []);
    if (action === "remove_cohost") setCohostIds(payload.cohostIds || []);
    if (action === "end") {
      await roomRef.current?.disconnect();
      router.replace("/" as Href);
    }
  }

  async function leave(end = false) {
    if (end && isHostSession) {
      try { await manage("end"); } catch (e) { setState(e instanceof Error ? e.message : "Could not end the session."); }
      return;
    }
    await roomRef.current?.disconnect();
    router.back();
  }

  const active = state === "connected";
  const canSpeak = liveRole === "host" || liveRole === "cohost";
  const barHeights = speaking
    ? (pulse ? [9, 25, 14, 30, 12] : [22, 12, 28, 15, 24])
    : [5, 5, 5, 5, 5];

  return (
    <AppShell back title={mode === "live" ? "Live" : "Room"} subtitle={title}>
      <View style={{ gap: 14 }}>
        <View style={{ padding: 20, borderRadius: 25, backgroundColor: mode === "live" ? "#2A0E16" : "#F3EBE2", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            {creator ? <CreatorMark mark={creator.creator_mark || id} size={31} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: mode === "live" ? "#F2D25B" : colors.brandDeep }}>
                {mode === "live" ? "LIVE NOW" : "ROOM LIVE"}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 22, color: mode === "live" ? "#fff" : colors.ink }}>{title}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: mode === "live" ? "#fff" : colors.ink }}>{count}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: mode === "live" ? "#E9D8E0" : colors.inkSoft }}>{count === 1 ? "person here" : "people here"}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 28 }}>
              {barHeights.map((height, index) => <View key={index} style={{ width: 4, height, borderRadius: 4, backgroundColor: speaking ? "#F2D25B" : (mode === "live" ? "#6C3A4B" : "#C8AAB6") }} />)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: mode === "live" ? "#E9D8E0" : colors.inkSoft }}>
                {speaking ? (speaker ? `Speaking · ${speaker}` : "Conversation is active") : "Waiting for conversation"}
              </Text>
            </View>
            {canSpeak ? <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: mode === "live" ? "#F2D25B" : colors.brandDeep }}>{liveRole === "host" ? "HOST" : "CO-HOST"}</Text> : null}
          </View>
          {creator ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: mode === "live" ? "#E9D8E0" : colors.inkSoft }}>@{creator.handle} · Creator</Text> : null}
        </View>

        {state === "connecting" ? <StatusMessage title="Connecting…" detail="Joining the realtime session." /> :
         state === "ended" ? <StatusMessage title="This session has ended." /> :
         !active ? <StatusMessage kind="error" title="Could not join the session." detail={state} /> : null}

        {active ? (
          <>
            <View ref={mediaRef} style={{ height: mode === "live" ? 360 : 100, borderRadius: 22, backgroundColor: "#0B0306", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              {mode === "room" ? <ChatCircleDots size={34} color="#F2D25B" /> : <Play size={34} color="#F2D25B" weight="fill" />}
            </View>

            {!canPlayAudio && !canSpeak ? <ActionButton label="Tap to enable audio" onPress={() => void startAudio()} /> : null}

            {canSpeak ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <ActionButton label={micOn ? "Mute mic" : "Turn mic on"} tone={micOn ? "primary" : "secondary"} onPress={() => void toggleMic()} />
                {mode === "live" ? <ActionButton label={cameraOn ? "Camera off" : "Camera on"} tone={cameraOn ? "primary" : "secondary"} onPress={() => void toggleCamera()} /> : null}
              </View>
            ) : null}

            <View style={{ padding: 16, borderRadius: 20, backgroundColor: "#F6F3F1", gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <UsersThree size={19} color={colors.brandDeep} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{count} {count === 1 ? "person" : "people"} in this {mode === "room" ? "Room" : "Live"}</Text>
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>
                {speaking ? (speaker ? `${speaker} is speaking now.` : "People are talking right now.") : mode === "room" ? "The Room is open. Speakers will light up as they talk." : "The Live is open. Viewers can watch and join the conversation."}
              </Text>
            </View>

            {isHostSession ? (
              <View style={{ padding: 16, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EDE6E1", gap: 11 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <UsersThree size={18} color={colors.brandDeep} />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Co-hosts</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkSoft }}>{cohostIds.length} added</Text>
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.inkSoft }}>
                  Only active Unmask Creators can be co-hosts. Co-hosts can speak and publish in this session.
                </Text>
                {creators.length ? creators.map(person => {
                  const added = cohostIds.includes(person.user_id);
                  return (
                    <View key={person.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
                      <CreatorMark mark={person.creator_mark} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{person.display_name}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkSoft }}>@{person.handle}</Text>
                      </View>
                      <Pressable onPress={() => void manage(added ? "remove_cohost" : "add_cohost", person.user_id)} style={{ minHeight: 34, paddingHorizontal: 11, borderRadius: 10, backgroundColor: added ? "#F3EBE2" : colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                        {added ? <X size={14} color={colors.brandDeep} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#fff" }}>Add</Text>}
                      </Pressable>
                    </View>
                  );
                }) : <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>No other active Unmask Creators are available right now.</Text>}
              </View>
            ) : null}

            <View style={{ borderWidth: 1, borderColor: "#EDE6E1", borderRadius: 20, overflow: "hidden", backgroundColor: "#fff" }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderColor: "#EDE6E1", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ChatCircleDots size={18} color={colors.brandDeep} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Live conversation</Text>
              </View>
              <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
                {chat.length ? chat.map(item => <View key={item.id} style={{ gap: 2 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.brandDeep }}>{item.name}</Text><Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink }}>{item.text}</Text></View>) : <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>No messages yet. Say something useful.</Text>}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderColor: "#EDE6E1" }}>
                <TextInput value={message} onChangeText={setMessage} onSubmitEditing={() => void sendMessage()} placeholder="Say something…" style={{ flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: "#F6F3F1", paddingHorizontal: 12, fontFamily: fonts.regular }} />
                <Pressable onPress={() => void sendMessage()} style={{ minWidth: 68, minHeight: 42, borderRadius: 14, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: fonts.semibold, color: "#fff", fontSize: 13 }}>Send</Text>
                </Pressable>
              </View>
            </View>

            {isHostSession ? (
              <View style={{ gap: 9 }}>
                <ActionButton tone="secondary" label="Leave & keep live" onPress={() => void leave(false)} />
                <ActionButton tone="secondary" label="End session" onPress={() => void leave(true)} />
              </View>
            ) : (
              <ActionButton tone="secondary" label="Leave session" onPress={() => void leave(false)} />
            )}
          </>
        ) : null}
      </View>
    </AppShell>
  );
}
