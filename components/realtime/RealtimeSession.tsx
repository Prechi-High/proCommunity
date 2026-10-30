import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Linking from "expo-linking";
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from "livekit-client";
import { db } from "@/lib/clarity/api";
import { supabase } from "@/lib/supabase";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { RoomExperience } from "@/components/room/RoomExperience";
import { ChatCircleDots, Play, UsersThree, X } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { roomProducts, roomTopic } from "@/lib/room/context";
import { arrangeRoom } from "@/lib/room/seats";
import type { RoomReactionKind } from "@/lib/room/types";
import { useAppStore } from "@/lib/store";

type ChatItem = { id: string; name: string; text: string };
type MicRequest = { user_id: string; display_name?: string; status: "pending" | "approved" | "denied" };
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
  const youName = useAppStore(s => s.profile?.displayName) || "You";
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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);
  const [anonymousListening, setAnonymousListening] = useState(false);
  const [liveRole, setLiveRole] = useState<"viewer" | "host" | "cohost">("viewer");
  const [isHostSession, setIsHostSession] = useState(host);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [cohostIds, setCohostIds] = useState<string[]>([]);
  const [cohostPermissions, setCohostPermissions] = useState<Record<string, { can_end?: boolean; can_manage_cohosts?: boolean }>>({});
  const [micRequests, setMicRequests] = useState<MicRequest[]>([]);
  const [micRequested, setMicRequested] = useState(false);
  const [micApproved, setMicApproved] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [invited, setInvited] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reactions, setReactions] = useState<Array<{ id: string; kind: RoomReactionKind; name: string }>>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<RoomReactionKind, number>>({ same: 0, differs: 0, clarify: 0, keep: 0 });
  const [sessionMeta, setSessionMeta] = useState<{ description: string; hostId: string | null; recordingStatus: string | null; metadata: unknown }>({
    description: "",
    hostId: null,
    recordingStatus: null,
    metadata: {},
  });
  const [managementError, setManagementError] = useState("");
  const inviteSeen = useRef(false);
  const encoder = useMemo(() => new TextEncoder(), []);
  const decoder = useMemo(() => new TextDecoder(), []);

  useEffect(() => {
    if (!speaking) return;
    const timer = setInterval(() => setPulse(v => (v + 1) % 2), 220);
    return () => clearInterval(timer);
  }, [speaking]);

  useEffect(() => {
    if (!id || state !== "connected") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await db().from("unmask_realtime_sessions").select("metadata").eq("id", id).single();
        if (cancelled || !data?.metadata) return;
        const metadata = data.metadata as any;
        const requests = Array.isArray(metadata.mic_requests) ? metadata.mic_requests as MicRequest[] : [];
        const permissions = metadata.cohost_permissions && typeof metadata.cohost_permissions === "object" ? metadata.cohost_permissions : {};
        setMicRequests(requests);
        setCohostPermissions(permissions);
        if (uid) {
          const mine = requests.find(item => String(item.user_id) === uid);
          if (mine?.status === "pending") {
            setMicRequested(true);
            setMicDenied(false);
          }
          if (mine?.status === "approved" && !micApproved) {
            setMicApproved(true);
            const room = roomRef.current;
            if (room) {
              try { await room.localParticipant.setMicrophoneEnabled(true); setMicOn(true); } catch {}
            }
          }
          if (mine?.status === "denied") {
            setMicRequested(false);
            setMicApproved(false);
            setMicDenied(true);
          }
        }
      } catch {}
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id, state, uid, micApproved]);

  useEffect(() => {
    if (mode !== "room" || !micApproved || liveRole !== "viewer" || inviteSeen.current) return;
    inviteSeen.current = true;
    setInvited(true);
    hapticSuccess();
  }, [micApproved, liveRole, mode]);

  useEffect(() => {
    if (!id) {
      setState(mode === "room" ? "Open this Room from the list to join." : "Open this session from Live or Room to join.");
      return;
    }
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
          body: JSON.stringify({ sessionId: id, role: host ? "host" : "cohost", anonymous: anonymousListening }),
        });
        const raw = await res.text();
        let payload: any = {};
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
        setAnonymousListening(Boolean(anonymousListening && payload.role === "viewer"));
        setIsHostSession(payload.role === "host");
        const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
        roomRef.current = room;
        const syncParticipants = () => setParticipants(Array.from(room.remoteParticipants.values()));
        const sync = () => {
          setCount(room.numParticipants + 1);
          syncParticipants();
          void syncPresence(room.activeSpeakers.length, room.activeSpeakers[0]?.name || room.activeSpeakers[0]?.identity || "");
        };
        const attachLocal = (track: any) => {
          if (Platform.OS !== "web" || !mediaRef.current) return;
          const el = track.attach();
          el.setAttribute("data-unmask-local-track", track.sid || "");
          if (track.kind === Track.Kind.Video) {
            el.style.width = "100%"; el.style.height = "100%"; el.style.objectFit = "cover"; el.style.borderRadius = "22px";
            el.muted = true;
            mediaRef.current.appendChild(el);
          } else {
            el.style.display = "none";
            mediaRef.current.appendChild(el);
          }
        };
        const onLocalTrack = (publication: any) => {
          if (publication?.track) attachLocal(publication.track);
        };
        const onTrack = (track: RemoteTrack) => attach(track);
        const onUntrack = (track: RemoteTrack) => detach(track);
        const onSpeaker = (people: Participant[]) => {
          const first = people[0];
          setActiveSpeakerIds(people.map(person => person.identity));
          setSpeaker(first?.name || first?.identity || "");
          setSpeaking(people.length > 0);
          void syncPresence(people.length, first?.name || first?.identity || "");
        };
        const onChat = (payloadBytes: Uint8Array, participant?: Participant) => {
          try {
            const item = JSON.parse(decoder.decode(payloadBytes));
            const anonymous = participant?.attributes?.anonymous === "true";
            const personName = anonymous ? "Anonymous" : participant?.name || participant?.identity || "Unmasker";
            if (item?.type === "reaction" && ["same", "differs", "clarify", "keep"].includes(item.kind)) {
              const reaction = { id: String(item.id || Date.now()), kind: item.kind as RoomReactionKind, name: personName };
              setReactions(old => [...old, reaction].slice(-8));
              setReactionCounts(old => ({ ...old, [reaction.kind]: (old[reaction.kind] || 0) + 1 }));
              setTimeout(() => setReactions(old => old.filter(entry => entry.id !== reaction.id)), 2600);
              return;
            }
            if (item?.type !== "chat" || !item.text) return;
            setChat(old => [...old, { id: item.id || String(Date.now()), name: personName, text: String(item.text) }].slice(-40));
          } catch {}
        };
        room.on(RoomEvent.ParticipantConnected, sync)
          .on(RoomEvent.ParticipantDisconnected, sync)
          .on(RoomEvent.ParticipantAttributesChanged, syncParticipants)
          .on(RoomEvent.LocalTrackPublished, onLocalTrack)
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
          .select("title,description,host_creator_id,recording_status,metadata,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)")
          .eq("id", id).single();
        if (!session.error) {
          setTitle(session.data?.title || title);
          setSessionMeta({
            description: session.data?.description || "",
            hostId: session.data?.host_creator_id || null,
            recordingStatus: session.data?.recording_status || null,
            metadata: session.data?.metadata || {},
          });
          const c = Array.isArray(session.data?.unmask_creators) ? session.data?.unmask_creators[0] : session.data?.unmask_creators;
          setCreator(c || null);
          const ids = Array.isArray(session.data?.metadata?.cohost_ids) ? session.data.metadata.cohost_ids.map(String) : [];
          setCohostIds(ids);
        }

        if (payload.role === "host" || payload.role === "cohost") {
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
          for (const publication of room.localParticipant.trackPublications.values()) {
            if (publication.track) attachLocal(publication.track);
          }
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
  }, [id, mode, host, decoder, uid, attempt]);

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

  async function setAnonymous(next: boolean) {
    const room = roomRef.current;
    if (!room || liveRole !== "viewer" || micApproved || micOn) return;
    try {
      await room.localParticipant.setAttributes({ anonymous: next ? "true" : "false" });
      setAnonymousListening(next);
    } catch (error) {
      setManagementError(error instanceof Error ? error.message : "Could not update anonymous listening.");
    }
  }

  async function manage(action: string, targetUserId?: string) {
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
    if (payload.cohostIds) setCohostIds(payload.cohostIds || []);
    if (payload.cohostPermissions) setCohostPermissions(payload.cohostPermissions || {});
    if (payload.micRequests) setMicRequests(payload.micRequests || []);
    if (action === "request_mic") {
      setMicRequested(true);
      setMicDenied(false);
    }
    if (action === "approve_mic" && targetUserId === uid) { setMicApproved(true); setMicRequested(false); }
    if (action === "deny_mic" && targetUserId === uid) { setMicRequested(false); setMicApproved(false); }
    if (action === "end") {
      await roomRef.current?.disconnect();
      router.replace((mode === "room" ? "/room" : "/") as Href);
    }
  }

  async function sendReaction(kind: RoomReactionKind) {
    const room = roomRef.current;
    if (!room || anonymousListening) return;
    const payload = { type: "reaction", id: `${Date.now()}-${Math.random()}`, kind };
    try {
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), { reliable: true, topic: "unmask-chat" });
      setReactions(old => [...old, { id: payload.id, kind, name: "You" }].slice(-8));
      setReactionCounts(old => ({ ...old, [kind]: (old[kind] || 0) + 1 }));
      setTimeout(() => setReactions(old => old.filter(entry => entry.id !== payload.id)), 2600);
    } catch (error) {
      setManagementError(error instanceof Error ? error.message : "Could not send that reaction.");
      hapticError();
    }
  }

  async function shareRoom() {
    const url = Linking.createURL(`/room/session?id=${encodeURIComponent(id)}`);
    try {
      await Share.share({ message: `${title} — a Room on Unmask\n${url}`, url });
    } catch {
      /* The share sheet was dismissed. */
    }
  }

  async function requestMic() {
    if (!supabase || !uid || micRequested || micApproved) return;
    if (anonymousListening) await setAnonymous(false);
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return;
    const response = await fetch("/api/realtime/token", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ action: "request_mic", sessionId: id }),
    });
    const raw = await response.text(); let payload:any={}; try { payload=raw?JSON.parse(raw):{}; } catch {}
    if (!response.ok) {
      setManagementError(payload.error || "Could not request the mic.");
      hapticError();
      return;
    }
    setMicRequested(true);
    setMicDenied(false);
  }

  async function leave(end = false) {
    const canEnd = isHostSession || !!cohostPermissions[uid || ""]?.can_end;
    if (end && canEnd) {
      try { await manage("end"); } catch (e) { setState(e instanceof Error ? e.message : "Could not end the session."); }
      return;
    }
    await roomRef.current?.disconnect();
    router.back();
  }

  const active = state === "connected";
  const canSpeak = liveRole === "host" || liveRole === "cohost" || micApproved;
  const canManageCohosts = isHostSession || !!cohostPermissions[uid || ""]?.can_manage_cohosts;
  const canEnd = isHostSession || !!cohostPermissions[uid || ""]?.can_end;
  const barHeights = speaking
    ? (pulse ? [9, 25, 14, 30, 12] : [22, 12, 28, 15, 24])
    : [5, 5, 5, 5, 5];
  const anonymousRemoteCount = participants.filter((person) => person.attributes?.anonymous === "true").length;
  const anonymousCount = anonymousRemoteCount + (anonymousListening ? 1 : 0);
  const visiblePeople = participants.filter((person) => person.attributes?.anonymous !== "true");
  const activePeople = participants.filter((person) => activeSpeakerIds.includes(person.identity));
  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";

  if (mode === "room") {
    const phase = state === "connecting" ? "connecting" : state === "connected" ? "live" : state === "ended" ? "ended" : "error";
    const youRole = isHostSession || liveRole === "host" ? "host" : liveRole === "cohost" ? "cohost" : canSpeak ? "speaker" : "listener";
    const arranged = arrangeRoom({
      hostId: sessionMeta.hostId || (isHostSession ? uid : "") || "",
      hostName: creator?.display_name || "Host",
      hostHandle: creator?.handle || null,
      hostMark: creator?.creator_mark || null,
      hostAvatar: creator?.avatar_url || null,
      youId: uid,
      youName,
      youRole,
      youMicOn: micOn,
      youAnonymous: anonymousListening,
      cohostIds,
      speakingIds: activeSpeakerIds,
      speakerIds: micRequests.filter((ask) => ask.status === "approved").map((ask) => ask.user_id),
      people: participants.map((person) => {
        let creatorMark: string | null = null;
        let handle: string | null = null;
        try {
          const parsed = person.metadata ? JSON.parse(person.metadata) : {};
          creatorMark = typeof parsed.creator_mark === "string" ? parsed.creator_mark : null;
          handle = typeof parsed.handle === "string" ? parsed.handle : null;
        } catch { /* LiveKit metadata is optional. */ }
        return {
          id: person.identity,
          name: person.name || "Unmasker",
          anonymous: person.attributes?.anonymous === "true",
          micOn: Boolean(person.isMicrophoneEnabled),
          speaking: activeSpeakerIds.includes(person.identity),
          creatorMark,
          handle,
        };
      }),
    });
    return (
      <RoomExperience
        phase={phase}
        errorDetail={phase === "error" ? state : undefined}
        title={title}
        description={sessionMeta.description}
        products={roomProducts(sessionMeta.metadata)}
        topic={roomTopic(sessionMeta.metadata)}
        recordingStatus={sessionMeta.recordingStatus}
        hostName={creator?.display_name || "Host"}
        hostHandle={creator?.handle}
        hostMark={creator?.creator_mark}
        hostAvatar={creator?.avatar_url}
        listenerCount={count}
        anonymousCount={anonymousCount}
        stage={arranged.stage}
        audience={arranged.audience}
        youRole={youRole}
        micOn={micOn}
        canSpeak={canSpeak}
        micRequested={micRequested}
        micDenied={micDenied}
        anonymous={anonymousListening}
        canToggleAnonymous={liveRole === "viewer" && !micApproved && !micOn}
        invited={invited}
        onDismissInvite={() => setInvited(false)}
        reactions={reactions}
        reactionCounts={reactionCounts}
        onReact={(kind) => void sendReaction(kind)}
        notes={chat}
        message={message}
        onMessage={setMessage}
        onSend={() => void sendMessage()}
        onToggleMic={() => void toggleMic()}
        onRequestMic={() => void requestMic()}
        onLeave={() => void leave(false)}
        onEnd={canEnd ? () => void leave(true) : undefined}
        onExit={() => {
          void roomRef.current?.disconnect();
          router.replace("/room" as Href);
        }}
        onRetry={() => {
          setManagementError("");
          setState("connecting");
          setAttempt((value) => value + 1);
        }}
        onShare={() => void shareRoom()}
        onToggleAnonymous={(next) => void setAnonymous(next)}
        minimized={minimized}
        onMinimize={() => setMinimized(true)}
        onExpand={() => setMinimized(false)}
        canHear={canPlayAudio}
        onStartAudio={() => void startAudio()}
        pendingMics={micRequests.filter((ask) => ask.status === "pending")}
        onApproveMic={(userId) => void manage("approve_mic", userId).catch((error) => setManagementError(error instanceof Error ? error.message : "Could not update the mic request."))}
        onDenyMic={(userId) => void manage("deny_mic", userId).catch((error) => setManagementError(error instanceof Error ? error.message : "Could not update the mic request."))}
        canManage={canManageCohosts || isHostSession}
        creators={creators.map((person) => ({
          user_id: person.user_id,
          display_name: person.display_name,
          handle: person.handle,
          creator_mark: person.creator_mark,
        }))}
        cohostIds={cohostIds}
        cohostPermissions={cohostPermissions}
        onManage={(action, userId) => {
          void manage(action, userId).catch((error) => {
            setManagementError(error instanceof Error ? error.message : "Could not update the Room.");
            hapticError();
          });
        }}
        notice={managementError}
        audioHost={
          <View
            ref={mediaRef}
            collapsable={false}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
          />
        }
      />
    );
  }

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
            <View ref={mediaRef} style={{ height: mode === "live" ? 360 : 100, borderRadius: 22, backgroundColor: "#050404", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <Play size={34} color="#F2D25B" weight="fill" />
            </View>
            <View style={{ padding: 18, borderRadius: 22, backgroundColor: colors.stage, gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ gap: 3 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>People here</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{count} listening{anonymousCount ? " · " + anonymousCount + " anonymous" : ""}</Text>
                </View>
                {speaking ? <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.brandDeep }}>LIVE TALKING</Text> : null}
              </View>
              {creator ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <CreatorMark mark={creator.creator_mark || id} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{creator.display_name}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkSoft }}>Host · @{creator.handle}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.hiSoft }}><Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.hiInk }}>HOST</Text></View>
                </View>
              ) : null}
              {activePeople.length ? (
                <View style={{ gap: 9 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.inkSoft, letterSpacing: 0.8 }}>SPEAKING NOW</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                    {activePeople.slice(0, 8).map((person) => (
                      <View key={person.identity} style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.white }}>{initials(person.name || person.identity)}</Text></View>
                        <Text numberOfLines={1} style={{ maxWidth: 120, fontFamily: fonts.medium, fontSize: 11, color: colors.ink }}>{person.name || person.identity}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {visiblePeople.length || (liveRole === "viewer" && !anonymousListening) ? (
                <View style={{ gap: 9 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.inkSoft, letterSpacing: 0.8 }}>LISTENERS</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 }}>
                    {visiblePeople.slice(0, 12).map((person) => (
                      <View key={person.identity} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.rosewoodSoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}><Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.brandDeep }}>{initials(person.name || person.identity)}</Text></View>
                    ))}
                    {liveRole === "viewer" && !anonymousListening ? <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: fonts.semibold, fontSize: 8, color: colors.white }}>YOU</Text></View> : null}
                    {anonymousCount ? <View style={{ paddingHorizontal: 10, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.inkSoft }}>+{anonymousCount} anonymous</Text></View> : null}
                  </View>
                </View>
              ) : null}
            </View>

            {!canPlayAudio && !canSpeak ? <ActionButton label="Tap to enable audio" onPress={() => void startAudio()} /> : null}

            {liveRole === "viewer" ? (
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: anonymousListening }} onPress={() => void setAnonymous(!anonymousListening)} style={{ padding: 15, borderRadius: 18, borderWidth: 1, borderColor: anonymousListening ? colors.brandDeep : colors.line, backgroundColor: anonymousListening ? colors.hiSoft : colors.stage, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 38, height: 24, borderRadius: 12, backgroundColor: anonymousListening ? colors.brandDeep : colors.bone3, padding: 3, justifyContent: "center", alignItems: anonymousListening ? "flex-end" : "flex-start" }}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white }} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>Listen anonymously</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.inkSoft }}>{anonymousListening ? "Your profile is hidden. You cannot speak or send chat while anonymous." : "Your profile is visible to other listeners."}</Text>
                </View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: anonymousListening ? colors.brandDeep : colors.inkSoft }}>{anonymousListening ? "ON" : "OFF"}</Text>
              </Pressable>
            ) : null}

            {canSpeak && !anonymousListening ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <ActionButton label={micOn ? "Mute mic" : "Turn mic on"} tone={micOn ? "primary" : "secondary"} onPress={() => void toggleMic()} />
                {mode === "live" ? <ActionButton label={cameraOn ? "Camera off" : "Camera on"} tone={cameraOn ? "primary" : "secondary"} onPress={() => void toggleCamera()} /> : null}
              </View>
            ) : null}

            <View style={{ padding: 16, borderRadius: 20, backgroundColor: colors.stage, gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <UsersThree size={19} color={colors.brandDeep} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{count} {count === 1 ? "person" : "people"} in this Live{anonymousCount ? " · " + anonymousCount + " anonymous" : ""}</Text>
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>
                {speaking ? (speaker ? `${speaker} is speaking now.` : "People are talking right now.") : "The Live is open. Viewers can watch and join the conversation."}
              </Text>
            </View>

            {canManageCohosts || isHostSession ? (
              <View style={{ padding: 16, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 11 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <UsersThree size={18} color={colors.brandDeep} />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Co-hosts</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkSoft }}>{cohostIds.length} added</Text>
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.inkSoft }}>
                  Only active Unmask Creators can be co-hosts. The host keeps final control unless specific permissions are delegated.
                </Text>
                {micRequests.filter(r => r.status === "pending").length ? (
                  <View style={{ padding: 12, borderRadius: 14, backgroundColor: colors.lac2, gap: 8 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>Mic requests</Text>
                    {micRequests.filter(r => r.status === "pending").map(request => (
                      <View key={request.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.ink }}>{request.display_name || request.user_id.slice(0, 8)} wants to speak.</Text>
                        <Pressable onPress={() => void manage("approve_mic", request.user_id)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: colors.brandDeep }}><Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.white }}>Allow</Text></Pressable>
                        <Pressable onPress={() => void manage("deny_mic", request.user_id)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: colors.stage }}><Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.ink }}>Decline</Text></Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {creators.length ? creators.map(person => {
                  const added = cohostIds.includes(person.user_id);
                  return (
                    <View key={person.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
                      <CreatorMark mark={person.creator_mark} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{person.display_name}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.inkSoft }}>@{person.handle}</Text>
                      </View>
                      {added ? (
                        <View style={{ alignItems: "flex-end", gap: 5 }}>
                          <Pressable onPress={() => void manage("remove_cohost", person.user_id)} style={{ minHeight: 32, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.lac2, alignItems: "center", justifyContent: "center" }}>
                            <X size={14} color={colors.brandDeep} />
                          </Pressable>
                          <View style={{ flexDirection: "row", gap: 5 }}>
                            <Pressable onPress={() => void manage(cohostPermissions[person.user_id]?.can_end ? "revoke_end" : "grant_end", person.user_id)} style={{ paddingHorizontal: 7, paddingVertical: 6, borderRadius: 8, backgroundColor: cohostPermissions[person.user_id]?.can_end ? "#F2D25B" : "#F6F3F1" }}>
                              <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.ink }}>{cohostPermissions[person.user_id]?.can_end ? "End ✓" : "End"}</Text>
                            </Pressable>
                            <Pressable onPress={() => void manage(cohostPermissions[person.user_id]?.can_manage_cohosts ? "revoke_cohost_management" : "grant_cohost_management", person.user_id)} style={{ paddingHorizontal: 7, paddingVertical: 6, borderRadius: 8, backgroundColor: cohostPermissions[person.user_id]?.can_manage_cohosts ? "#9FD0AB" : "#F6F3F1" }}>
                              <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.ink }}>{cohostPermissions[person.user_id]?.can_manage_cohosts ? "Manage ✓" : "Manage"}</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable onPress={() => void manage("add_cohost", person.user_id)} style={{ minHeight: 34, paddingHorizontal: 11, borderRadius: 10, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>Add</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }) : <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>No other active Unmask Creators are available right now.</Text>}
              </View>
            ) : null}

            <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: "hidden", backgroundColor: colors.white }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ChatCircleDots size={18} color={colors.brandDeep} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Live conversation</Text>
              </View>
              <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
                {chat.length ? chat.map(item => <View key={item.id} style={{ gap: 2 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.brandDeep }}>{item.name}</Text><Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink }}>{item.text}</Text></View>) : <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{anonymousListening ? "Anonymous listening is read-only." : "No messages yet. Say something useful."}</Text>}
              </ScrollView>
              {anonymousListening ? (
                <View style={{ padding: 13, backgroundColor: colors.stage, borderTopWidth: 1, borderColor: colors.line }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, textAlign: "center" }}>
                    You’re listening anonymously · chat and reactions are off
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderColor: colors.line }}>
                  <TextInput value={message} onChangeText={setMessage} onSubmitEditing={() => void sendMessage()} placeholder="Say something…" placeholderTextColor={colors.inkSoft} style={{ flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: colors.stage, color: colors.ink, paddingHorizontal: 12, fontFamily: fonts.regular }} />
                  <Pressable onPress={() => void sendMessage()} style={{ minWidth: 68, minHeight: 42, borderRadius: 14, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.semibold, color: colors.white, fontSize: 13 }}>Send</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {canEnd ? (
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
