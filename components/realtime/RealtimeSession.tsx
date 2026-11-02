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
import { LiveVideoStage } from "@/components/realtime/LiveVideoStage";
import { ChatCircleDots, Play, UsersThree, X } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { applyRoomNote, applyRoomUltras } from "@/lib/room/channel";
import { foldRoomEvents, joinRoom, loadRoomEvents, postRoomEvent } from "@/lib/room/persist";
import { momentsFromUpdates, questionTitle, timelineFromJourney, type RoomTimeline, type RoomUltra } from "@/lib/room/cards";
import { roomProducts, roomTopic } from "@/lib/room/context";
import { useRoomDock } from "@/lib/room/dock";
import { ROOM_EMOJI_IDS } from "@/lib/room/emoji";
import { arrangeRoom } from "@/lib/room/seats";
import type { RoomReactionKind } from "@/lib/room/types";
import { contribute, create as createUltra, summary, validAmount, wallet } from "@/lib/investigations/api";
import { journey, journeys, patchJourney, saveJourney } from "@/lib/living/api";
import { updates as journeyUpdates } from "@/lib/tracking/api";
import { monthlySparks } from "@/lib/membership";
import { ULTRA_UNMASK_SPARK_GOAL } from "@/lib/unmask/status";
import { useAppStore } from "@/lib/store";

type ChatItem = { id: string; name: string; text: string; experience?: RoomTimeline | null };

function freshId() {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (slot) => {
    const value = Math.floor(Math.random() * 16);
    return (slot === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
type MicRequest = { user_id: string; display_name?: string; status: "pending" | "approved" | "denied" | "revoked" };
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
  const storeMinimized = useRoomDock((state) => state.active?.id === id && state.active.minimized);
  const roomRef = useRef<Room | null>(null);
  const mediaRef = useRef<any>(null);
  const [state, setState] = useState("connecting");
  const [count, setCount] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [productTrayOpen, setProductTrayOpen] = useState(false);
  const [guestPanelOpen, setGuestPanelOpen] = useState(false);
  const [stageLayout, setStageLayout] = useState<"panel" | "grid">("panel");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [videoAttached, setVideoAttached] = useState(false);
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
  const [armed, setArmed] = useState(mode !== "room" || host);
  const [outputOn, setOutputOn] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [reactions, setReactions] = useState<Array<{ id: string; kind: RoomReactionKind; name: string }>>([]);
  const [reactionTotal, setReactionTotal] = useState(0);
  const [timelines, setTimelines] = useState<RoomTimeline[]>([]);
  const [ultras, setUltras] = useState<RoomUltra[]>([]);
  const [ultraRequestStatus, setUltraRequestStatus] = useState<Record<string, "pending" | "approved" | "declined">>({});
  const [ultraRequestIds, setUltraRequestIds] = useState<Record<string, string>>({});
  const [sparksBalance, setSparksBalance] = useState<number | null>(null);
  const [thunderBalance, setThunderBalance] = useState<number | null>(null);
  const anonymousRef = useRef(false);
  anonymousRef.current = anonymousListening;
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
    if (mode !== "room" || state !== "connected" || !id) return;
    let dead = false;
    void (async () => {
      await joinRoom(id);
      const rows = await loadRoomEvents(id);
      if (dead) return;
      const folded = foldRoomEvents(rows);
      setChat((current) => folded.notes.reduce((notes, note) => applyRoomNote(notes, { type: "chat", id: note.id, text: note.text, experience: note.experience }, note.name), current));
      setUltras((current) => folded.ultras.reduce((list, card) => applyRoomUltras(list, { type: "ultra", card }), current));
      setReactionTotal((current) => Math.max(current, folded.reactionCount));
    })().catch((error) => {
      if (!dead) setManagementError(error instanceof Error ? error.message : "Could not load this Room's replies.");
    });
    return () => { dead = true; };
  }, [id, mode, state]);

  useEffect(() => {
    if (mode !== "room" || state !== "connected") return;
    let dead = false;
    void journeys()
      .then((rows) => { if (!dead) setTimelines(rows.map((row) => timelineFromJourney(row, youName))); })
      .catch(() => { if (!dead) setTimelines([]); });
    void wallet()
      .then((pocket) => { if (!dead) { setSparksBalance(pocket?.sparks ?? 0); setThunderBalance(pocket?.thunder ?? 0); } })
      .catch(() => { if (!dead) { setSparksBalance(null); setThunderBalance(null); } });
    return () => { dead = true; };
  }, [mode, state, youName]);

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
          if (mine?.status === "approved") {
            setMicRequested(false);
            setMicDenied(false);
            setMicApproved(true);
            const room = roomRef.current;
            if (room && !room.localParticipant.isMicrophoneEnabled) {
              try { await room.localParticipant.setMicrophoneEnabled(true); setMicOn(true); } catch {}
            }
          }
          if (mine?.status === "denied" || mine?.status === "revoked") {
            setMicRequested(false);
            setMicApproved(false);
            setMicDenied(mine.status === "denied");
            const room = roomRef.current;
            if (room?.localParticipant.isMicrophoneEnabled) {
              try { await room.localParticipant.setMicrophoneEnabled(false); setMicOn(false); } catch {}
            }
          }
        }
      } catch {}
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id, state, uid, micApproved]);
  useEffect(() => {
    if (mode !== "room" || state !== "connected" || !uid) return;
    let dead = false;
    const pollUltraRequests = async () => {
      try {
        const [sent, received] = await Promise.all([
          db().from("unmask_support_requests").select("id,investigation_id,timeline_id,status,kind").eq("user_id", uid).in("kind", ["unmask_request","experience_ultra_request"]),
          db().from("unmask_support_requests").select("id,investigation_id,timeline_id,status,kind").eq("recipient_user_id", uid).in("kind", ["unmask_request","experience_ultra_request"]),
        ]);
        if (dead) return;
        const rows = [...(sent.data || []), ...(received.data || [])] as Array<{ id: string; investigation_id: string | null; timeline_id: string | null; status: string; kind: string }>;
        const statusMap: Record<string, "pending" | "approved" | "declined"> = {};
        const idMap: Record<string, string> = {};
        for (const row of rows) {
          if (!row.investigation_id) continue;
          if (row.status === "pending" || row.status === "approved" || row.status === "declined") {
            statusMap[row.investigation_id] = row.status;
            idMap[row.investigation_id] = row.id;
          }
        }
        setUltraRequestStatus(statusMap);
        setUltraRequestIds(idMap);
      } catch {}
    };
    void pollUltraRequests();
    const timer = setInterval(() => void pollUltraRequests(), 2500);
    return () => { dead = true; clearInterval(timer); };
  }, [id, mode, state, uid]);


  useEffect(() => {
    if (mode !== "room" || !micApproved || liveRole !== "viewer" || inviteSeen.current) return;
    inviteSeen.current = true;
    setInvited(true);
    hapticSuccess();
  }, [micApproved, liveRole, mode]);

  useEffect(() => {
    if (mode !== "room" || !id) return;
    let dead = false;
    void db().from("unmask_realtime_sessions")
      .select("title,description,host_creator_id,recording_status,metadata,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)")
      .eq("id", id).single().then(({ data, error }) => {
        if (dead || error || !data) return;
        setTitle(data.title || "Room");
        setSessionMeta({
          description: data.description || "",
          hostId: data.host_creator_id || null,
          recordingStatus: data.recording_status || null,
          metadata: data.metadata || {},
        });
        const joined = Array.isArray(data.unmask_creators) ? data.unmask_creators[0] : data.unmask_creators;
        setCreator(joined || null);
        const ids = Array.isArray(data.metadata?.cohost_ids) ? data.metadata.cohost_ids.map(String) : [];
        setCohostIds(ids);
        const present = Number(data.metadata?.participant_count || 0);
        if (present) setCount(present);
      });
    return () => { dead = true; };
  }, [id, mode]);

  useEffect(() => {
    if (mode === "room" && !armed) return;
    if (!id) {
      setState(mode === "room" ? "Open this Room from the list to join." : "Open this session from Live or Room to join.");
      return;
    }
    let dead = false;
    const attach = (track: RemoteTrack) => {
      if (Platform.OS !== "web" || !mediaRef.current || mode === "live") return;
      const el = track.attach();
      el.setAttribute("data-unmask-track", track.sid || "");
      if (track.kind === Track.Kind.Video) {
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = track.source === Track.Source.ScreenShare ? "contain" : "cover";
        el.style.position = "absolute";
        el.style.zIndex = track.source === Track.Source.ScreenShare ? "5" : "1";
        el.style.inset = "0";
        el.style.borderRadius = "22px";
        setVideoAttached(true);
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
          body: JSON.stringify({ sessionId: id, role: host ? "host" : "cohost", anonymous: anonymousRef.current }),
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
          if (Platform.OS !== "web" || !mediaRef.current || mode === "live") return;
          const el = track.attach();
          el.setAttribute("data-unmask-local-track", track.sid || "");
          if (track.kind === Track.Kind.Video) {
            el.style.width = "100%"; el.style.height = "100%"; el.style.objectFit = track.source === Track.Source.ScreenShare ? "contain" : "cover"; el.style.position = "absolute"; el.style.inset = "0"; el.style.zIndex = track.source === Track.Source.ScreenShare ? "5" : "1"; el.style.borderRadius = "22px";
            el.muted = true;
            setVideoAttached(true);
            mediaRef.current.appendChild(el);
          } else {
            el.style.display = "none";
            mediaRef.current.appendChild(el);
          }
        };
        const onLocalTrack = (publication: any) => {
          if (publication?.track) attachLocal(publication.track);
        };
        const onTrack = (track: RemoteTrack) => { attach(track); syncParticipants(); };
        const onUntrack = (track: RemoteTrack) => { detach(track); syncParticipants(); };
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
            if (item?.type === "reaction" && ROOM_EMOJI_IDS.includes(item.kind)) {
              const reaction = { id: String(item.id || Date.now()), kind: item.kind as RoomReactionKind, name: personName };
              setReactionTotal((count) => count + 1);
              setReactions(old => [...old, reaction].slice(-8));
              setTimeout(() => setReactions(old => old.filter(entry => entry.id !== reaction.id)), 2600);
              return;
            }
            ingest(item, personName);
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
          .on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => {
            if (!participant || participant.identity !== room.localParticipant.identity) return;
            if (payload.role === "host" || payload.role === "cohost") return;
            const can = !!room.localParticipant.permissions?.canPublish;
            if (can) {
              setMicApproved(true);
              setMicRequested(false);
              setMicDenied(false);
              room.localParticipant.setMicrophoneEnabled(true).then(() => { if (!dead) setMicOn(true); }).catch(() => {});
            } else {
              setMicApproved(false);
              setMicRequested(false);
              room.localParticipant.setMicrophoneEnabled(false).then(() => { if (!dead) setMicOn(false); }).catch(() => {});
            }
          })
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
  }, [id, mode, host, decoder, uid, attempt, armed]);


  // Tracks can arrive before the Live video surface mounts. Re-attach existing
  // tracks after the connected UI has rendered so viewers do not see a blank stage.
  useEffect(() => {
    if (mode !== "room" || state !== "connected" || Platform.OS !== "web") return;
    const surface = mediaRef.current;
    const room = roomRef.current;
    if (!surface || !room) return;

    const attachOnce = (track: any, local = false) => {
      if (!track || typeof track.attach !== "function") return;
      const sid = String(track.sid || "");
      const attribute = local ? "data-unmask-local-track" : "data-unmask-track";
      const existing = Array.from(surface.children || []).some((child: any) =>
        child?.getAttribute?.(attribute) === sid
      );
      if (existing) return;
      try {
        const element = track.attach();
        element.setAttribute(attribute, sid);
        element.autoplay = true;
        element.playsInline = true;
        if (track.kind === Track.Kind.Video) {
          element.style.width = "100%";
          element.style.height = "100%";
          element.style.objectFit = track.source === Track.Source.ScreenShare ? "contain" : "cover";
          element.style.position = "absolute";
          element.style.zIndex = track.source === Track.Source.ScreenShare ? "5" : "1";
          element.style.inset = "0";
          element.style.borderRadius = "22px";
          if (local) element.muted = true;
          setVideoAttached(true);
        } else {
          element.style.display = "none";
        }
        surface.appendChild(element);
        if (!local && track.kind === Track.Kind.Audio) {
          void element.play?.().catch?.(() => setCanPlayAudio(false));
        }
      } catch {
        // TrackSubscribed/LocalTrackPublished handlers remain responsible for later tracks.
      }
    };

    for (const publication of room.localParticipant.trackPublications.values()) {
      if (publication.track) attachOnce(publication.track, true);
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.isSubscribed && publication.track) attachOnce(publication.track, false);
      }
    }
  }, [mode, state, attempt]);

  function ingest(raw: unknown, author: string) {
    setChat((notes) => applyRoomNote(notes, raw, author));
    setUltras((list) => applyRoomUltras(list, raw));
  }

  async function publish(payload: object) {
    const room = roomRef.current;
    if (!room) throw new Error("The Room is not connected.");
    await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), { reliable: true, topic: "unmask-chat" });
  }

  async function sendMessage(textOverride?: string, timeline?: RoomTimeline | null) {
    const text = (textOverride ?? message).trim();
    if (!text && !timeline) return;
    if (textOverride == null) setMessage("");
    const payload = { type: "chat", id: freshId(), text, experience: timeline ? { ...timeline, authorId: uid } : null, authorId: uid };
    try {
      if (mode === "room") await postRoomEvent(id, "chat", youName, { text, experience: timeline ? { ...timeline, authorId: uid } : null, authorId: uid }, payload.id);
      await publish(payload);
      ingest(payload, youName);
    } catch (error) {
      if (textOverride == null) setMessage(text);
      setManagementError(error instanceof Error ? error.message : "Could not send that reply.");
    }
  }

  async function loadTimelines() {
    const rows = await journeys();
    const cards = await Promise.all(rows.slice(0, 8).map(async (row) => {
      const card = timelineFromJourney(row, youName, uid);
      try {
        card.entries = momentsFromUpdates(await journeyUpdates(row.id));
      } catch { card.entries = []; }
      return card;
    }));
    const tracked = cards.filter((card) => card.entries.length > 0);
    setTimelines(tracked);
    return tracked;
  }

  async function loadTimelineById(timelineId: string, fallback?: { author?: string | null; authorId?: string | null }) {
    const row = await journey(timelineId);
    const card = timelineFromJourney(
      row,
      fallback?.author?.trim() || youName,
      fallback?.authorId || null,
    );
    try {
      card.entries = momentsFromUpdates(await journeyUpdates(row.id));
    } catch {
      card.entries = [];
    }
    return card;
  }

  async function createTimeline() {
    const product = roomProducts(sessionMeta.metadata)[0];
    if (!product?.id) throw new Error("This Room has no product id yet, so a timeline can't start from here.");
    const journey = await saveJourney({
      product_id: product.id,
      acquisition: "Using",
      status: "active",
      goal: "Tracking this in the Room",
      visibility: "public",
    });
    const card = timelineFromJourney(journey, youName, uid);
    setTimelines((current) => [card, ...current.filter((item) => item.id !== card.id)]);
    return card;
  }

  async function publishTimeline(item: RoomTimeline) {
    await patchJourney(item.id, { visibility: "public" });
    const next = { ...item, visibility: "public" as const };
    setTimelines((current) => current.map((row) => row.id === item.id ? next : row));
    return next;
  }

  async function requestExperienceUltra(item: RoomTimeline) {
    if (!item.authorId || item.authorId === uid) throw new Error("You can start the Ultra yourself.");
    const result = await db().rpc("request_experience_ultra", {
      p_timeline_id: item.id,
      p_recipient: item.authorId,
      p_message: youName + " wants permission to start an Ultra Unmask on your " + item.productName + " experience.",
    });
    if (result.error) throw new Error(result.error.message);
    setUltraRequestStatus((current) => ({ ...current, ["timeline:" + item.id]: "pending" }));
    if (result.data) setUltraRequestIds((current) => ({ ...current, ["timeline:" + item.id]: String(result.data) }));
  }

  async function requestUltra(card: RoomUltra) {
    if (!card.authorId || card.authorId === uid) return;
    const result = await db().rpc("request_unmask", {
      p_investigation_id: card.id,
      p_recipient: card.authorId,
      p_message: youName + " wants to request an Unmask for " + card.productName,
    });
    if (result.error) throw new Error(result.error.message);
    setUltraRequestStatus((current) => ({ ...current, [card.id]: "pending" }));
    if (result.data) setUltraRequestIds((current) => ({ ...current, [card.id]: String(result.data) }));
  }

  async function respondUnmaskRequest(requestId: string, status: "approved" | "declined") {
    const result = await db().rpc("respond_unmask_request", { p_request_id: requestId, p_status: status });
    if (result.error) throw new Error(result.error.message);
    const key = Object.keys(ultraRequestIds).find((item) => ultraRequestIds[item] === requestId);
    if (key) setUltraRequestStatus((current) => ({ ...current, [key]: status }));
  }

  async function loadContextTimelines(card: RoomUltra) {
    const result = await db().rpc("list_unmask_context_timelines", { p_investigation_id: card.id, p_session_id: id });
    if (result.error) throw new Error(result.error.message);
    return (result.data || []) as Array<{ id: string; product_name: string; brand: string | null; image_url: string | null; visibility: string }>;
  }

  async function requestUltraContext(
    card: RoomUltra,
    question: string,
    timelineId: string | null,
    customProductName: string,
    customProductPhotoPath: string | null,
  ) {
    if (!isHostSession && !cohostIds.includes(uid || "")) {
      throw new Error("Only the Room host or a co-host can request more detail.");
    }
    const result = await db().rpc("request_ultra_context", {
      p_investigation_id: card.id,
      p_session_id: id,
      p_question: question,
      p_timeline_id: timelineId || null,
      p_custom_product_name: customProductName || null,
      p_custom_product_photo_path: customProductPhotoPath || null,
    });
    if (result.error) throw new Error(result.error.message);
    setManagementError("Detail request sent to " + card.author + ".");
  }

  async function startUltra(input: { who: "company" | "expert"; question: string; experience: string; timeline?: RoomTimeline | null; sparks: number; thunder: number }) {
    const sparks = input.sparks >= 10 ? input.sparks : 0;
    const thunder = input.thunder >= 1 ? input.thunder : 0;
    if (!sparks && !thunder) throw new Error("Add at least 10 Sparks or 1 Thunder Spark.");
    if (sparks && sparksBalance != null && sparks > sparksBalance) throw new Error("Not enough Sparks. Claim your monthly Sparks without leaving the Room.");
    if (thunder && thunderBalance != null && thunder > thunderBalance) throw new Error("Not enough Thunder Sparks.");
    if (input.question.trim().length < 8) throw new Error("Write the question you want answered.");
    const product = roomProducts(sessionMeta.metadata)[0];
    const name = input.timeline?.productName || product?.name || "this product";
    const opening = sparks
      ? { kind: "sparks" as const, amount: sparks }
      : { kind: "thunder" as const, amount: thunder };
    const investigation = await createUltra({
      title: questionTitle(input.question, name),
      concern: input.experience.trim().slice(0, 3000),
      product_id: product?.id || null,
      question_id: null,
      experience_id: null,
      supporting_links: "",
      attached_journey_id: input.timeline?.id || null,
      attached_experience_id: null,
    }, { ...opening, key: freshId() });
    if (sparks && thunder) await contribute(investigation.id, "thunder", thunder, true, freshId());
    let sparkCount = sparks;
    let thunderCount = thunder;
    let supporters = [{ name: youName }];
    try {
      const totals = await summary(investigation.id);
      sparkCount = totals.sparks;
      thunderCount = totals.thunder;
      const named = totals.backers.map((person) => ({ name: person.name || "Unmasker" })).filter((person) => person.name);
      if (named.length) supporters = named;
    } catch { /* the opening contribution is the one that just landed */ }
    const card: RoomUltra = {
      id: investigation.id,
      title: investigation.title || questionTitle(input.question, name),
      path: input.who,
      productName: name,
      experience: input.experience.trim() || input.timeline?.outcome || null,
      sparks: sparkCount,
      thunder: thunderCount,
      goal: investigation.spark_goal || ULTRA_UNMASK_SPARK_GOAL,
      supporters,
      author: youName,
      authorId: uid,
      pinned: false,
      timelineId: input.timeline?.id,
      imageUrl: input.timeline?.imageUrl || null,
    };
    const event = { type: "ultra", card };
    if (mode === "room") await postRoomEvent(id, "ultra", youName, { card }, card.id);
    await publish(event);
    ingest(event, youName);
    const pocket = await wallet().catch(() => null);
    if (pocket) { setSparksBalance(pocket.sparks); setThunderBalance(pocket.thunder); }
  }

  async function addSparks(id: string, amount: number) {
    if (!validAmount("sparks", String(amount))) throw new Error("Sparks start at 10.");
    if (sparksBalance != null && amount > sparksBalance) throw new Error("Not enough Sparks. Claim your monthly Sparks without leaving the Room.");
    const receipt = await contribute(id, "sparks", amount, true, freshId());
    const named = (receipt.summary?.backers || []).map((person) => ({ name: person.name || "Unmasker" })).filter((person) => person.name);
    const event = { type: "spark", id, sparks: receipt.summary?.sparks ?? receipt.sparks, thunder: receipt.summary?.thunder, supporters: named };
    if (mode === "room") await postRoomEvent(id, "spark", youName, { id, sparks: event.sparks, thunder: event.thunder, supporters: named }, freshId());
    await publish(event);
    ingest(event, youName);
    const pocket = await wallet().catch(() => null);
    if (pocket) { setSparksBalance(pocket.sparks); setThunderBalance(pocket.thunder); }
  }

  async function claimRoomSparks() {
    const result = await monthlySparks(true);
    setSparksBalance(result.sparks);
    return result.sparks;
  }

  async function toggleMic() {
    const room = roomRef.current; if (!room) return;
    const next = !micOn; await room.localParticipant.setMicrophoneEnabled(next); setMicOn(next);
  }

  async function toggleCamera() {
    const room = roomRef.current; if (!room || mode !== "live" || (liveRole !== "host" && liveRole !== "cohost")) return;
    const next = !cameraOn; await room.localParticipant.setCameraEnabled(next); setCameraOn(next);
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room || (liveRole !== "host" && liveRole !== "cohost")) return;
    if (Platform.OS !== "web") {
      setManagementError("Screen broadcasting on iOS and Android needs the native LiveKit screen-capture extension. It is not enabled in this build yet.");
      return;
    }
    try {
      const next = !screenShareOn;
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenShareOn(next);
      setManagementError("");
    } catch (error) {
      setManagementError(error instanceof Error ? error.message : "Could not start screen sharing. Check your browser permission.");
    }
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
      if (mode === "room") useRoomDock.getState().close();
      else router.replace("/" as Href);
    }
  }

  async function sendReaction(kind: RoomReactionKind) {
    const room = roomRef.current;
    if (!room || anonymousListening) return;
    const payload = { type: "reaction", id: freshId(), kind };
    try {
      if (mode === "room") await postRoomEvent(id, "reaction", youName, { kind }, payload.id);
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), { reliable: true, topic: "unmask-chat" });
      setReactionTotal((count) => count + 1);
      setReactions(old => [...old, { id: payload.id, kind, name: youName }].slice(-8));
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
    if (mode === "room") {
      useRoomDock.getState().close();
      return;
    }
    router.back();
  }

  async function toggleOutput() {
    const room = roomRef.current;
    const next = !outputOn;
    setOutputOn(next);
    if (!room) return;
    room.remoteParticipants.forEach((person) => {
      person.audioTrackPublications.forEach((publication) => {
        const track = publication.track as { setVolume?: (volume: number) => void } | undefined;
        track?.setVolume?.(next ? 1 : 0);
      });
    });
  }

  async function copyRoomLink() {
    const url = Linking.createURL(`/room/session?id=${encodeURIComponent(id)}`);
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); return; } catch { /* fall through */ }
    }
    await shareRoom();
  }

  const active = state === "connected";
  const liveProducts = roomProducts(sessionMeta.metadata);
  const featuredProduct = liveProducts.find((item) => item.id === selectedProductId) || liveProducts[0] || null;
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
    const phase = !armed ? "prejoin" : state === "connecting" ? "connecting" : state === "connected" ? "live" : state === "ended" ? "ended" : "error";
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
        reactionTotal={reactionTotal}
        onReact={(kind) => void sendReaction(kind)}
        notes={chat}
        message={message}
        onMessage={setMessage}
        onSend={() => void sendMessage()}
        onSendDetail={(text, timeline) => void sendMessage(text, timeline)}
        timelines={timelines}
        ultras={ultras}
        sparksBalance={sparksBalance}
        thunderBalance={thunderBalance}
        onLoadTimelines={loadTimelines}
        onLoadTimelineById={loadTimelineById}
        onPublishTimeline={publishTimeline}
        onCreateTimeline={createTimeline}
        onStartUltra={startUltra}
        onAddSparks={addSparks}
        onPinUltra={(cardId) => void (async () => {
          if (mode === "room") await postRoomEvent(id, "pin", youName, { id: cardId }, `pin-${cardId}`);
          await publish({ type: "pin", id: cardId });
          ingest({ type: "pin", id: cardId }, youName);
        })().catch((error) => setManagementError(error instanceof Error ? error.message : "Could not highlight that Ultra Unmask."))}
        onNudgeUltra={(card) => { /* handled by the Room detail sheet */ }}
        onRequestUltra={requestUltra}
        onRequestUltraContext={requestUltraContext}
        onLoadContextTimelines={loadContextTimelines}
        onRequestExperienceUltra={requestExperienceUltra}
        ultraRequestStatus={ultraRequestStatus}
        ultraRequestIds={ultraRequestIds}
        onRespondUltraRequest={respondUnmaskRequest}
        viewerId={uid}
        onClaimSparks={claimRoomSparks}
        onToggleMic={() => void toggleMic()}
        onRequestMic={() => void requestMic()}
        onLeave={() => void leave(false)}
        onEnd={canEnd ? () => void leave(true) : undefined}
        onExit={() => {
          void roomRef.current?.disconnect();
          useRoomDock.getState().close();
        }}
        onRetry={() => {
          setManagementError("");
          setState("connecting");
          setArmed(true);
          setAttempt((value) => value + 1);
        }}
        onStart={() => {
          setState("connecting");
          setArmed(true);
        }}
        onShare={() => void shareRoom()}
        onCopyLink={() => void copyRoomLink()}
        onToggleAnonymous={(next) => void setAnonymous(next)}
        minimized={storeMinimized}
        onMinimize={() => {
          setMinimized(true);
          useRoomDock.getState().minimize();
        }}
        onExpand={() => {
          setMinimized(false);
          useRoomDock.getState().expand();
        }}
        outputOn={outputOn}
        onToggleOutput={() => void toggleOutput()}
        canHear={canPlayAudio}
        onStartAudio={() => void startAudio()}
        pendingMics={micRequests.filter((ask) => ask.status === "pending")}
        onApproveMic={(userId) => void manage("approve_mic", userId).catch((error) => setManagementError(error instanceof Error ? error.message : "Could not update the mic request."))}
        onDenyMic={(userId) => void manage("deny_mic", userId).catch((error) => setManagementError(error instanceof Error ? error.message : "Could not update the mic request."))}
        onInviteSpeaker={(userId) => void manage("invite_speaker", userId).catch((error) => setManagementError(error instanceof Error ? error.message : "Could not invite them to speak."))}
        onRemoveSpeaker={(userId) => void manage("remove_speaker", userId).catch((error) => setManagementError(error instanceof Error ? error.message : "Could not move them to the audience."))}
        onMuteSpeaker={(userId) => void manage("mute_speaker", userId).catch((error) => setManagementError(error instanceof Error ? error.message : "Could not mute them."))}
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

  if (mode === "live") {
    return (
      <View style={{ flex: 1, minHeight: "100%", backgroundColor: "#10070B" }}>
        <View style={{ flex: 1, position: "relative", backgroundColor: "#16090F" }}>
          <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", backgroundColor: "#16090F" }}>
            {state === "connected" && roomRef.current ? <LiveVideoStage participants={participants} localParticipant={roomRef.current.localParticipant} layout={stageLayout} /> : (
              <View pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Play size={42} color="#F2D25B" weight="fill" />
                <Text style={{ color: "#F3EBE2", fontFamily: fonts.medium, fontSize: 13 }}>{state === "connecting" ? "Connecting to the Live…" : "Waiting for the creator's video…"}</Text>
              </View>
            )}
          </View>
          <View pointerEvents="box-none" style={{ position: "absolute", top: 12, left: 12, right: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Pressable onPress={() => void leave(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#16090FCC", alignItems: "center", justifyContent: "center" }}><X size={18} color="#fff" /></Pressable>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 7, borderRadius: 22, backgroundColor: "#16090FCC" }}>
                {creator ? <CreatorMark mark={creator.creator_mark || id} size={34} /> : null}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 12 }}>{creator?.display_name || "Unmask Creator"}</Text>
                  <Text numberOfLines={1} style={{ color: "#E9D8E0", fontFamily: fonts.regular, fontSize: 10 }}>{creator?.handle ? "@" + creator.handle : title}</Text>
                </View>
                <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: "#D92D20" }}><Text style={{ color: "#fff", fontFamily: fonts.bold, fontSize: 10 }}>LIVE</Text></View>
                <Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 11, marginRight: 5 }}>{count}</Text>
              </View>
              <Pressable onPress={() => void shareRoom()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#16090FCC", alignItems: "center", justifyContent: "center" }}><UsersThree size={18} color="#fff" /></Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Pressable onPress={() => setStageLayout("panel")} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: stageLayout === "panel" ? "#F2D25B" : "#16090FCC" }}><Text style={{ color: stageLayout === "panel" ? "#2A0E16" : "#fff", fontFamily: fonts.semibold, fontSize: 10 }}>PANEL</Text></Pressable>
              <Pressable onPress={() => setStageLayout("grid")} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: stageLayout === "grid" ? "#F2D25B" : "#16090FCC" }}><Text style={{ color: stageLayout === "grid" ? "#2A0E16" : "#fff", fontFamily: fonts.semibold, fontSize: 10 }}>GRID</Text></Pressable>
              {screenShareOn ? <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: "#F2D25B" }}><Text style={{ color: "#2A0E16", fontFamily: fonts.semibold, fontSize: 10 }}>SCREEN SHARING</Text></View> : null}
            </View>
          </View>

          <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom: 14, gap: 12 }}>
            {featuredProduct ? (
              <Pressable onPress={() => setProductTrayOpen(true)} style={{ alignSelf: "flex-start", maxWidth: "88%", flexDirection: "row", alignItems: "center", gap: 10, padding: 10, paddingRight: 15, borderRadius: 15, backgroundColor: "#16090FEF", borderWidth: 1, borderColor: "#F2D25B77" }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#F3EBE2", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#2A0E16", fontFamily: fonts.bold, fontSize: 17 }}>U</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#F2D25B", fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 0.7 }}>PRODUCT UNDER INVESTIGATION</Text>
                  <Text numberOfLines={1} style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 13 }}>{featuredProduct.name}</Text>
                  {featuredProduct.brand ? <Text style={{ color: "#E9D8E0", fontFamily: fonts.regular, fontSize: 10 }}>{featuredProduct.brand}</Text> : null}
                </View>
                <Text style={{ color: "#F2D25B", fontFamily: fonts.semibold, fontSize: 11 }}>View</Text>
              </Pressable>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <View style={{ flex: 1, gap: 7 }}>
                <Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 13 }}>{title}</Text>
                <Text numberOfLines={2} style={{ color: "#F3EBE2", fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 }}>{sessionMeta.description || "A live product investigation. Share what you know and ask what you want to find out."}</Text>
                {chat.slice(-3).map(item => <View key={item.id} style={{ alignSelf: "flex-start", maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#16090FBF" }}><Text numberOfLines={2} style={{ color: "#fff", fontFamily: fonts.regular, fontSize: 11 }}><Text style={{ fontFamily: fonts.semibold }}>{item.name}: </Text>{item.text}</Text></View>)}
              </View>
              <View style={{ alignItems: "center", gap: 15 }}>
                <View style={{ alignItems: "center", gap: 3 }}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF20", alignItems: "center", justifyContent: "center" }}><UsersThree size={20} color="#fff" /></View><Text style={{ color: "#fff", fontSize: 9, fontFamily: fonts.semibold }}> {count} </Text></View>
                <Pressable onPress={() => setProductTrayOpen(true)} style={{ alignItems: "center", gap: 3 }}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF20", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#F2D25B", fontSize: 19 }}>▣</Text></View><Text style={{ color: "#fff", fontSize: 9, fontFamily: fonts.semibold }}>PRODUCT</Text></Pressable>
              </View>
            </View>
            {liveRole === "viewer" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput value={message} onChangeText={setMessage} onSubmitEditing={() => void sendMessage()} placeholder="Ask a question…" placeholderTextColor="#D7C7CE" style={{ flex: 1, minHeight: 43, borderRadius: 24, paddingHorizontal: 15, color: "#fff", backgroundColor: "#16090FCC", fontFamily: fonts.regular }} />
                <Pressable onPress={() => void sendMessage()} style={{ width: 43, height: 43, borderRadius: 22, backgroundColor: "#F2D25B", alignItems: "center", justifyContent: "center" }}><ChatCircleDots size={19} color="#2A0E16" /></Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => void toggleMic()} style={{ flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#FFFFFF20", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 11 }}>{micOn ? "Mute mic" : "Unmute mic"}</Text></Pressable>
                <Pressable onPress={() => void toggleCamera()} style={{ flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#FFFFFF20", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 11 }}>{cameraOn ? "Camera off" : "Camera on"}</Text></Pressable>
                <Pressable onPress={() => void toggleScreenShare()} style={{ flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: screenShareOn ? "#F2D25B" : "#FFFFFF20", alignItems: "center", justifyContent: "center" }}><Text style={{ color: screenShareOn ? "#2A0E16" : "#fff", fontFamily: fonts.semibold, fontSize: 11 }}>{screenShareOn ? "Stop share" : "Share screen"}</Text></Pressable>
              </View>
            )}
            {liveRole === "viewer" && !canPlayAudio ? <Pressable onPress={() => void startAudio()} style={{ alignSelf: "center", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F2D25B" }}><Text style={{ color: "#2A0E16", fontFamily: fonts.semibold, fontSize: 11 }}>Tap to enable sound</Text></Pressable> : null}
            {(liveRole === "host" || liveRole === "cohost") ? (
              <Pressable onPress={() => setGuestPanelOpen(true)} style={{ alignSelf: "flex-start", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFFFFF24", borderWidth: 1, borderColor: "#FFFFFF45" }}>
                <Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 11 }}>＋ Invite a guest · {cohostIds.length} on stage</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => void requestMic()} style={{ alignSelf: "flex-start", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFFFFF24" }}>
                <Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 11 }}>{micRequested ? "Stage request sent" : "Request to join the conversation"}</Text>
              </Pressable>
            )}
            {canEnd ? <Pressable onPress={() => void leave(true)} style={{ alignSelf: "center", padding: 7 }}><Text style={{ color: "#F3EBE2", fontFamily: fonts.medium, fontSize: 10 }}>End Live</Text></Pressable> : null}
          </View>
        </View>
        {guestPanelOpen ? (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#fff", gap: 12, maxHeight: "72%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 }}>Bring someone on stage</Text><Pressable onPress={() => setGuestPanelOpen(false)}><X size={20} color={colors.ink} /></Pressable></View>
            <Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 }}>Invite an active Unmask Creator as a co-host. They can join with their own camera and microphone.</Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
              {creators.map(person => {
                const added = cohostIds.includes(person.user_id);
                return <View key={person.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 13, backgroundColor: "#F7F4F2" }}>
                  <CreatorMark mark={person.creator_mark || person.user_id} size={34} />
                  <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 12 }}>{person.display_name}</Text><Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 10 }}>@{person.handle}</Text></View>
                  <Pressable disabled={added} onPress={() => void manage("add_cohost", person.user_id).then(() => setGuestPanelOpen(false)).catch(error => setManagementError(error instanceof Error ? error.message : "Could not invite this guest."))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: added ? "#E7E1DD" : "#2A0E16" }}><Text style={{ color: added ? colors.inkSoft : "#fff", fontFamily: fonts.semibold, fontSize: 10 }}>{added ? "On stage" : "Invite"}</Text></Pressable>
                </View>;
              })}
              {!creators.length ? <Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12 }}>No other active Unmask Creators are available to invite right now.</Text> : null}
            </ScrollView>
          </View>
        ) : null}
        {productTrayOpen ? (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#fff", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 }}>Products in this Live</Text><Pressable onPress={() => setProductTrayOpen(false)}><X size={20} color={colors.ink} /></Pressable></View>
            {liveProducts.length ? liveProducts.map((product, index) => (
              <Pressable key={product.id || product.name} onPress={() => { setSelectedProductId(product.id || null); setProductTrayOpen(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 15, backgroundColor: "#F7F4F2", borderWidth: 1, borderColor: featuredProduct?.name === product.name ? "#F2D25B" : "#E9E2DE" }}>
                <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: "#EDE5E0", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#2A0E16", fontFamily: fonts.bold, fontSize: 16 }}>{index + 1}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 13 }}>{product.name}</Text><Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 11 }}>{product.brand || "Product being discussed"}</Text></View>
                <Text style={{ color: colors.brandDeep, fontFamily: fonts.semibold, fontSize: 11 }}>Select</Text>
              </Pressable>
            )) : <Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 13 }}>The creator hasn't attached a product yet.</Text>}
            <Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 11 }}>Product cards open the investigation context; checkout is not enabled in Unmask Live.</Text>
          </View>
        ) : null}
      </View>
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
            <View ref={mediaRef} collapsable={false} style={{ height: mode === "live" ? 520 : 100, borderRadius: 22, backgroundColor: "#050404", overflow: "hidden", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {!videoAttached ? (
                <View pointerEvents="none" style={{ alignItems: "center", gap: 8 }}>
                  <Play size={34} color="#F2D25B" weight="fill" />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#E9D8E0" }}>Waiting for creator video…</Text>
                </View>
              ) : null}
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
