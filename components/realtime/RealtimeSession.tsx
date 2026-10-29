import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from "livekit-client";
import { db } from "@/lib/clarity/api";
import { supabase } from "@/lib/supabase";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { ChatCircleDots, Play, UsersThree } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";

type ChatItem = { id: string; name: string; text: string };

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
  const roomRef = useRef<Room | null>(null);
  const mediaRef = useRef<any>(null);
  const [state, setState] = useState("connecting");
  const [count, setCount] = useState(0);
  const [micOn, setMicOn] = useState(host);
  const [cameraOn, setCameraOn] = useState(mode === "live" && host);
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [speaker, setSpeaker] = useState("");
  const [title, setTitle] = useState(mode === "live" ? "Live" : "Room");
  const [creator, setCreator] = useState<any>(null);
  const encoder = useMemo(() => new TextEncoder(), []);
  const decoder = useMemo(() => new TextDecoder(), []);

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
          body: JSON.stringify({ sessionId: id, role: host ? "host" : "viewer" }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Could not join the session.");

        const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
        roomRef.current = room;
        const sync = () => setCount(room.numParticipants);
        const onTrack = (track: RemoteTrack) => attach(track);
        const onUntrack = (track: RemoteTrack) => detach(track);
        const onSpeaker = (people: Participant[]) => setSpeaker(people[0]?.name || people[0]?.identity || "");
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

        const session = await db().from("unmask_realtime_sessions").select("title,host_creator_id,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)").eq("id", id).single();
        if (!session.error) {
          setTitle(session.data?.title || title);
          const c = Array.isArray(session.data?.unmask_creators) ? session.data?.unmask_creators[0] : session.data?.unmask_creators;
          setCreator(c || null);
        }

        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.isSubscribed && publication.track) attach(publication.track as RemoteTrack);
          }
        }

        if (host) {
          if (mode === "live") {
            await room.localParticipant.setCameraEnabled(true);
            await room.localParticipant.setMicrophoneEnabled(true);
          } else {
            await room.localParticipant.setMicrophoneEnabled(true);
          }
        }
        setState("connected");
      } catch (e) {
        if (!dead) setState(e instanceof Error ? e.message : "Could not join the session.");
      }
    })();

    return () => {
      dead = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [id, mode, host, decoder]);

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
    const room = roomRef.current; if (!room || mode !== "live") return;
    const next = !cameraOn; await room.localParticipant.setCameraEnabled(next); setCameraOn(next);
  }

  async function startAudio() {
    const room = roomRef.current;
    if (!room) return;
    try { await room.startAudio(); setCanPlayAudio(true); } catch {}
  }

  async function leave(end = false) {
    const room = roomRef.current;
    if (end && host) {
      await db().from("unmask_realtime_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", id);
    }
    await room?.disconnect();
    router.back();
  }

  const active = state === "connected";
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
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: mode === "live" ? "#E9D8E0" : colors.inkSoft }}>{count} here</Text>
          </View>
          {creator ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: mode === "live" ? "#E9D8E0" : colors.inkSoft }}>@{creator.handle} · {creator.verification_level === "verified_professional" ? "Verified professional" : creator.verification_level === "expert" ? "Expert" : "Creator"}</Text> : null}
        </View>

        {state === "connecting" ? <StatusMessage title="Connecting…" detail="Joining the realtime session." /> :
         state === "ended" ? <StatusMessage title="This session has ended." /> :
         !active ? <StatusMessage kind="error" title="Could not join the session." detail={state} /> : null}

        {active ? (
          <>
            <View ref={mediaRef} style={{ height: mode === "live" ? 360 : 80, borderRadius: 22, backgroundColor: "#0B0306", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              {mode === "room" ? <ChatCircleDots size={34} color="#F2D25B" /> : <Play size={34} color="#F2D25B" weight="fill" />}
              {speaker ? <View style={{ position: "absolute", bottom: 14, left: 14, right: 14, padding: 10, borderRadius: 14, backgroundColor: "#0B0306CC" }}><Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#fff" }}>Speaking · {speaker}</Text></View> : null}
            </View>

            {!canPlayAudio && !host ? <ActionButton label="Tap to enable audio" onPress={() => void startAudio()} /> : null}

            {host ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <ActionButton label={micOn ? "Mute mic" : "Turn mic on"} tone={micOn ? "primary" : "secondary"} onPress={() => void toggleMic()} />
                {mode === "live" ? <ActionButton label={cameraOn ? "Camera off" : "Camera on"} tone={cameraOn ? "primary" : "secondary"} onPress={() => void toggleCamera()} /> : null}
              </View>
            ) : null}

            <View style={{ padding: 16, borderRadius: 20, backgroundColor: "#F6F3F1", gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <UsersThree size={19} color={colors.brandDeep} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{count} {count === 1 ? "person" : "people"} connected</Text>
              </View>
              {host ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>You are hosting. Keep the conversation useful, calm and evidence-led.</Text> : <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{mode === "room" ? "You joined as a listener. The host controls who gets speaking access." : "You joined as a viewer. Camera and microphone stay off."}</Text>}
            </View>

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

            <ActionButton tone="secondary" label={host ? "End session" : "Leave session"} onPress={() => void leave(host)} />
          </>
        ) : null}
      </View>
    </AppShell>
  );
}
