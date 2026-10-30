import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInRight,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ArrowsIn,
  ArrowsOut,
  CaretDown,
  ChatCircle,
  Check,
  DotsThree,
  Flag,
  Gear,
  Heart,
  LinkSimple,
  ListBullets,
  Microphone,
  MicrophoneSlash,
  PaperPlaneRight,
  Pause,
  Play,
  ShareNetwork,
  UsersThree,
  X,
} from "@/components/icons";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { ROOM_EMOJIS, roomEmoji } from "@/lib/room/emoji";
import { recordingCopy } from "@/lib/room/context";
import type { RoomProductChip, RoomReactionKind, RoomSeat } from "@/lib/room/types";
import { useUnmaskTheme } from "@/lib/useUnmaskTheme";
import { initials } from "@/lib/unmask/time";
import type { RoomTimeline, RoomUltra } from "@/lib/room/cards";
import { DragHandle, FloatEmoji, PartialSheet, PressScale, Tick } from "./motion";
import { AttachPill, ExperienceCard, ExperienceSheet, TimelineDraft, TimelinePicker, UltraCard, UltraCreate } from "./RoomStories";

export type RoomNote = { id: string; name: string; text: string; experience?: RoomTimeline | null };
export type RoomReaction = { id: string; kind: RoomReactionKind; name: string };
export type MicAsk = { user_id: string; display_name?: string };
export type CohostPerson = {
  user_id: string;
  display_name: string;
  handle: string;
  creator_mark: string;
};
export type CohostPowers = { can_end?: boolean; can_manage_cohosts?: boolean };

export type RoomExperienceProps = {
  phase: "prejoin" | "connecting" | "live" | "ended" | "error";
  errorDetail?: string;
  sample?: boolean;
  title: string;
  description: string;
  products: RoomProductChip[];
  topic?: string;
  recordingStatus?: string | null;
  hostName: string;
  hostHandle?: string | null;
  hostMark?: string | null;
  hostAvatar?: string | null;
  listenerCount: number;
  anonymousCount: number;
  stage: RoomSeat[];
  audience: RoomSeat[];
  youRole: RoomSeat["role"];
  micOn: boolean;
  canSpeak: boolean;
  micRequested: boolean;
  micDenied: boolean;
  anonymous: boolean;
  canToggleAnonymous: boolean;
  invited: boolean;
  onDismissInvite: () => void;
  reactions: RoomReaction[];
  reactionTotal?: number;
  onReact: (kind: RoomReactionKind) => void;
  notes: RoomNote[];
  message: string;
  onMessage: (value: string) => void;
  onSend: () => void;
  onToggleMic: () => void;
  onRequestMic: () => void;
  onLeave: () => void;
  onEnd?: () => void;
  onExit: () => void;
  onRetry?: () => void;
  onStart: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onToggleAnonymous: (next: boolean) => void;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  outputOn: boolean;
  onToggleOutput: () => void;
  canHear: boolean;
  onStartAudio: () => void;
  pendingMics: MicAsk[];
  onApproveMic: (userId: string) => void;
  onDenyMic: (userId: string) => void;
  onInviteSpeaker: (userId: string) => void;
  onRemoveSpeaker: (userId: string) => void;
  onMuteSpeaker: (userId: string) => void;
  timelines?: RoomTimeline[];
  ultras?: RoomUltra[];
  sparksBalance?: number | null;
  thunderBalance?: number | null;
  onSendDetail?: (text: string, timeline: RoomTimeline | null) => void;
  onLoadTimelines?: () => Promise<RoomTimeline[]>;
  onCreateTimeline?: () => Promise<RoomTimeline | null>;
  onStartUltra?: (input: { who: "company" | "expert"; question: string; timeline?: RoomTimeline | null; sparks: number; thunder: number }) => Promise<void>;
  onPublishTimeline?: (item: RoomTimeline) => Promise<RoomTimeline | null>;
  onAddSparks?: (id: string, amount: number) => Promise<void>;
  onPinUltra?: (id: string) => void;
  onNudgeUltra?: (card: RoomUltra) => void;
  onClaimSparks?: () => Promise<number | null>;
  focus?: "replies" | "replies-full" | "picker" | "private" | "draft" | "card" | "timeline" | "timeline-full" | "full" | "ultra" | "ultra-sparks" | "ultra-seal" | "spark" | "notice";
  canManage: boolean;
  creators: CohostPerson[];
  cohostIds: string[];
  cohostPermissions: Record<string, CohostPowers>;
  onManage: (action: string, userId?: string) => void;
  notice?: string;
  audioHost?: ReactNode;
};

const ROLE_LABEL = { host: "Host", cohost: "Co-host", speaker: "Speaker", listener: "Listener" } as const;
const webFill = Platform.OS === "web" ? ({ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 } as unknown as ViewStyle) : null;

export function RoomExperience(props: RoomExperienceProps) {
  useUnmaskTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const sheetWidth = Math.min(width, 430);
  const [menu, setMenu] = useState(false);
  const [share, setShare] = useState(false);
  const [guests, setGuests] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [chat, setChat] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [reported, setReported] = useState(false);
  const [rules, setRules] = useState(false);
  const [dataUse, setDataUse] = useState(false);
  const [mediaNote, setMediaNote] = useState("");
  const [personMenu, setPersonMenu] = useState<RoomSeat | null>(null);
  const [openExperience, setOpenExperience] = useState<RoomTimeline | null>(null);
  const [ultraOpen, setUltraOpen] = useState(false);
  const [ultraTimeline, setUltraTimeline] = useState<RoomTimeline | null>(null);
  const [ultraBusy, setUltraBusy] = useState(false);
  const [ultraError, setUltraError] = useState("");
  const [sparkBurst, setSparkBurst] = useState("");
  const [sparkError, setSparkError] = useState("");
  const [sparkErrorId, setSparkErrorId] = useState("");
  const [roomFull, setRoomFull] = useState(false);
  const [experienceFull, setExperienceFull] = useState(false);
  const prejoin = props.phase === "prejoin" || props.phase === "connecting";
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || !props.focus) return;
    focused.current = true;
    if (props.focus === "replies" || props.focus === "replies-full" || props.focus === "card" || props.focus === "spark" || props.focus === "picker" || props.focus === "private" || props.focus === "draft") setChat(true);
    if (props.focus === "notice") setDataUse(true);
    if (props.focus === "full" || props.focus === "replies-full" || props.focus === "timeline-full") setRoomFull(true);
    if (props.focus === "timeline" || props.focus === "timeline-full") {
      setOpenExperience(props.notes.find((note) => note.experience)?.experience || null);
      if (props.focus === "timeline-full") setExperienceFull(true);
    }
    if (props.focus === "ultra" || props.focus === "ultra-sparks" || props.focus === "ultra-seal") {
      setUltraTimeline(props.notes.find((note) => note.experience)?.experience || null);
      setUltraOpen(true);
    }
  }, [props.focus, props.notes]);
  const people = useMemo(() => [...props.stage, ...props.audience], [props.stage, props.audience]);
  const extraListeners = Math.max(props.anonymousCount, Math.max(0, props.listenerCount - people.length));

  if (props.minimized && props.phase !== "prejoin") {
    return (
      <View pointerEvents="box-none" style={[{ flex: 1, justifyContent: "flex-end" }, webFill]}>
        {props.audioHost}
        <MiniPlayer {...props} width={sheetWidth} bottom={Math.max(insets.bottom, 10)} />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, justifyContent: "flex-end", alignItems: "center" }, webFill]}>
      {props.audioHost}
      <Pressable
        accessibilityLabel="Room is open"
        onPress={props.phase === "live" ? props.onMinimize : undefined}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
      />
      <Animated.View
        entering={reduced ? undefined : SlideInDown.springify().damping(18).stiffness(180)}
        style={{
          width: sheetWidth,
          height: roomFull ? height : undefined,
          maxHeight: roomFull ? height : height * 0.92,
          backgroundColor: colors.wine,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          overflow: "hidden",
          paddingBottom: Math.max(insets.bottom, 8),
        }}
      >
        <DragHandle expanded={roomFull} onExpand={() => setRoomFull(true)} onCollapse={() => setRoomFull(false)} onDismiss={prejoin ? props.onExit : props.onMinimize} />
        {props.sample ? (
          <Text style={{ textAlign: "center", fontFamily: fonts.medium, fontSize: 11, color: colors.honeyInk, paddingTop: 4 }}>
            Sample layout. Not a live Room.
          </Text>
        ) : null}
        <Header
          prejoin={prejoin}
          connecting={props.phase === "connecting"}
          onClose={prejoin ? props.onExit : props.onMinimize}
          onShare={() => setShare(true)}
          onMenu={() => setMenu(true)}
          onLeave={props.onLeave}
          full={roomFull}
          onToggleFull={() => setRoomFull((value) => !value)}
        />
        {props.phase === "error" || props.phase === "ended" ? (
          <Terminal {...props} />
        ) : (
          <ScrollView style={{ maxHeight: Math.max(220, (roomFull ? height : height * 0.92) - (prejoin ? 430 : 180)) }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 14 }}>
            {props.phase === "connecting" ? (
              <Text style={{ textAlign: "center", fontFamily: fonts.semibold, fontSize: 16, color: colors.inkSoft }}>Connecting</Text>
            ) : null}
            {!prejoin ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>
                LIVE · {props.listenerCount} listening
              </Text>
            ) : null}
            <RichTitle title={props.title || "Room"} topic={props.topic} />
            {props.invited ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brand }}>You're on the mic.</Text>
            ) : null}
            {props.micDenied ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>The host left you listening.</Text>
            ) : null}
            {props.notice ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{props.notice}</Text> : null}
            {!prejoin ? (
              <Carousel
                {...props}
                width={sheetWidth - 32}
                burstId={sparkBurst}
                sparkError={sparkError}
                sparkErrorId={sparkErrorId}
                onOpenUltra={() => { setUltraTimeline(null); setUltraError(""); setUltraOpen(true); }}
                onSpark={(id) => {
                  setSparkError("");
                  void props.onAddSparks?.(id, 10).then(() => {
                    setSparkBurst(id);
                    setTimeout(() => setSparkBurst((current) => current === id ? "" : current), 1600);
                  }).catch((error: unknown) => {
                    setSparkErrorId(id);
                    setSparkError(error instanceof Error ? error.message : "Could not add Sparks.");
                  });
                }}
                onClaim={() => {
                  void props.onClaimSparks?.().then(() => setSparkError("")).catch((error: unknown) => {
                    setSparkError(error instanceof Error ? error.message : "Could not claim Sparks.");
                  });
                }}
              />
            ) : null}
            {!props.canHear && props.phase === "live" ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Tap to hear the Room" onPress={props.onStartAudio} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.brand }}>Tap to hear the Room</Text>
              </Pressable>
            ) : null}
            {props.canManage && props.pendingMics.length ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`${props.pendingMics.length} mic requests`} onPress={() => setGuests(true)} style={{ minHeight: 44, borderRadius: 14, backgroundColor: colors.goldSoft, paddingHorizontal: 12, justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.honeyInk }}>
                  {props.pendingMics.length === 1 ? "1 person wants to speak" : `${props.pendingMics.length} people want to speak`}
                </Text>
              </Pressable>
            ) : null}
            <PeopleGrid
              people={people.length ? people : hostFallback(props)}
              reactions={props.reactions}
              pending={props.pendingMics}
              micRequested={props.micRequested}
              onPerson={props.canManage ? setPersonMenu : undefined}
            />
            {captions ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>Captions aren't available for this Room yet.</Text>
            ) : null}
          </ScrollView>
        )}
        {prejoin ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
            {extraListeners > 0 ? (
              <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>+{extraListeners} other listeners</Text>
              </View>
            ) : null}
            <AnonymousRow {...props} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
              {recordingNotice(props.recordingStatus)}{" "}
              <Text style={{ color: colors.brand }} onPress={() => setDataUse(true)}>Learn more</Text>
            </Text>
            <GradientButton label="Start Listening" busy={props.phase === "connecting"} onPress={props.onStart} />
          </View>
        ) : props.phase === "live" ? (
          <DockBar
            {...props}
            emojiOpen={emoji}
            noteCount={props.notes.length}
            onPeople={() => setGuests(true)}
            onEmoji={() => setEmoji((open) => !open)}
            onChat={() => setChat(true)}
            onPick={(kind) => {
              props.onReact(kind);
              setEmoji(false);
            }}
          />
        ) : null}
        {menu ? (
          <MenuPopover
            captions={captions}
            reported={reported}
            onClose={() => setMenu(false)}
            onSettings={() => {
              setMenu(false);
              setGuests(true);
            }}
            onFeedback={() => {
              setMenu(false);
              setChat(true);
            }}
            onRules={() => setRules(true)}
            onCaptions={() => setCaptions((value) => !value)}
            onNotInterested={props.onLeave}
            onReport={() => setReported(true)}
            canEnd={!!props.onEnd}
            onEnd={props.onEnd}
            canStartUltra={!!props.onStartUltra && props.canManage}
            onUltra={() => { setMenu(false); setUltraTimeline(null); setUltraError(""); setUltraOpen(true); }}
          />
        ) : null}
        {rules ? <Rules onClose={() => setRules(false)} /> : null}
        {dataUse ? <DataUse status={props.recordingStatus} onClose={() => setDataUse(false)} /> : null}
      </Animated.View>
      {share ? <ShareSheet onClose={() => setShare(false)} onShare={props.onShare} onCopy={props.onCopyLink} /> : null}
      {guests ? <GuestsSheet {...props} onClose={() => setGuests(false)} /> : null}
      {personMenu ? <PersonMenu seat={personMenu} {...props} onClose={() => setPersonMenu(null)} /> : null}
      <ExperienceSheet item={openExperience} full={experienceFull} onToggleFull={() => setExperienceFull((value) => !value)} onClose={() => { setOpenExperience(null); setExperienceFull(false); }} onDeeper={() => { setUltraTimeline(openExperience); setOpenExperience(null); setUltraOpen(true); }} />
      <UltraCreate
        open={ultraOpen}
        step={props.focus === "ultra-sparks" || props.focus === "ultra-seal" ? 1 : 0}
        productName={props.products[0]?.name || props.title}
        timeline={ultraTimeline}
        balance={props.sparksBalance ?? null}
        thunderBalance={props.thunderBalance ?? null}
        busy={ultraBusy}
        error={ultraError}
        onClose={() => setUltraOpen(false)}
        onClaim={() => { void props.onClaimSparks?.(); }}
        onCreate={(who, question, sparks, thunder) => {
          if (!props.onStartUltra) return;
          setUltraBusy(true);
          setUltraError("");
          void props.onStartUltra({ who, question, timeline: ultraTimeline, sparks, thunder }).then(() => {
            setUltraOpen(false);
          }).catch((error: unknown) => {
            setUltraError(error instanceof Error ? error.message : "The Ultra Unmask did not start.");
          }).finally(() => setUltraBusy(false));
        }}
      />
      {chat ? (
        <ChatSheet
          {...props}
          mediaNote={mediaNote}
          burstId={sparkBurst}
          sparkError={sparkError}
          sparkErrorId={sparkErrorId}
          onMedia={() => setMediaNote("Photos and GIFs aren't part of this Room.")}
          onClose={() => setChat(false)}
          initialPicker={props.focus === "picker" || props.focus === "private"}
          confirmPrivate={props.focus === "private"}
          initialDraft={props.focus === "draft" ? (props.timelines || []).find((item) => item.visibility === "public") || null : null}
          initialFull={props.focus === "replies-full"}
          onOpenExperience={setOpenExperience}
          onDeeper={(timeline) => { setUltraTimeline(timeline); setUltraError(""); setUltraOpen(true); }}
          onSpark={(id) => {
            setSparkError("");
            void props.onAddSparks?.(id, 10).then(() => {
              setSparkBurst(id);
              setTimeout(() => setSparkBurst((current) => current === id ? "" : current), 1600);
            }).catch((error: unknown) => {
              setSparkErrorId(id);
              setSparkError(error instanceof Error ? error.message : "Could not add Sparks.");
            });
          }}
          onClaim={() => {
            void props.onClaimSparks?.().then(() => setSparkError("")).catch((error: unknown) => {
              setSparkError(error instanceof Error ? error.message : "Could not claim Sparks.");
            });
          }}
        />
      ) : null}
    </View>
  );
}

function recordingNotice(status?: string | null) {
  const copy = recordingCopy(status);
  if (copy.failed) return "Recording didn't start. Your voice is not being saved right now. Replies are still deleted when the Room ends.";
  if (copy.active && status === "recording") return "This Room is being recorded. The audio and a transcript of what is said are kept after it ends. Replies and attached timelines are deleted when it ends. An Ultra Unmask you release stays.";
  return "A recording is not running yet. If one is saved, the audio and a transcript are kept after the Room ends. Replies and attached timelines are deleted when it ends. An Ultra Unmask you release stays.";
}

function DataUse({ status, onClose }: { status?: string | null; onClose: () => void }) {
  const recording = status === "recording" || status === "processing" || status === "ready";
  return (
    <Pressable accessibilityLabel="Close data use" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center", zIndex: 8 }}>
      <Pressable onPress={() => undefined} style={{ width: "100%", maxWidth: 430, maxHeight: "80%", backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 10 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink }}>How this Room uses what you share</Text>
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink }}>Your voice and the words said in the Room can be kept as audio and a transcript after the Room ends. They may be shown to other people and used to bring others in and help people understand the product.</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink }}>Replies, reactions, and product timelines attached inside replies are visible to everyone in the Room while it is live. They are deleted when the Room ends.</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink }}>An Ultra Unmask you release is a real request. It stays on Unmask after the Room ends, including on the community pages.</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink }}>Anonymous listening is quiet. You are not shown, you cannot speak or react, and your voice is not recorded. Your presence is not listed.</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>{recording ? "A recording has been requested for this Room. A file is kept only when the audio actually lands in storage." : "This Room is not recording yet. LiveKit egress and speech-to-text are not connected in this build, so no audio file or transcript is created until they are. Nothing here is a fake recording."}</Text>
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.brand }}>Close</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

function hostFallback(props: RoomExperienceProps): RoomSeat[] {
  return [{
    id: "host",
    name: props.hostName || "Host",
    role: "host",
    speaking: false,
    muted: false,
    handle: props.hostHandle,
    creatorMark: props.hostMark,
    avatarUrl: props.hostAvatar,
  }];
}

function Header({
  prejoin,
  connecting,
  onClose,
  onShare,
  onMenu,
  onLeave,
  full,
  onToggleFull,
}: {
  prejoin: boolean;
  connecting: boolean;
  onClose: () => void;
  onShare: () => void;
  onMenu: () => void;
  onLeave: () => void;
  full?: boolean;
  onToggleFull?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 48 }}>
      <IconHit label={prejoin ? "Close" : "Minimize Room"} onPress={onClose}>
        {prejoin ? <X size={22} color={colors.ink} /> : <CaretDown size={22} color={colors.ink} weight="bold" />}
      </IconHit>
      <View style={{ flex: 1, alignItems: "center" }}>
        {connecting ? null : <View />}
      </View>
      {prejoin ? null : (
        <IconHit label={full ? "Collapse Room" : "Expand Room"} onPress={onToggleFull || onClose}>
          {full ? <ArrowsIn size={20} color={colors.ink} /> : <ArrowsOut size={20} color={colors.ink} />}
        </IconHit>
      )}
      {prejoin ? null : (
        <IconHit label="Share" onPress={onShare}>
          <ShareNetwork size={22} color={colors.ink} />
        </IconHit>
      )}
      <IconHit label="More" onPress={onMenu}>
        <DotsThree size={24} color={colors.ink} weight="bold" />
      </IconHit>
      {prejoin ? <View style={{ width: 8 }} /> : (
        <Pressable accessibilityRole="button" accessibilityLabel="Leave" onPress={() => { hapticSelect(); onLeave(); }} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.coral }}>Leave</Text>
        </Pressable>
      )}
    </View>
  );
}

function IconHit({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PressScale label={label} onPress={onPress} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      {children}
    </PressScale>
  );
}

function RichTitle({ title, topic }: { title: string; topic?: string }) {
  const parts = title.split(/([#@][\w.]+)/g);
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: colors.ink, letterSpacing: -0.4 }}>
      {parts.map((part, index) => /^[#@]/.test(part) ? <Text key={index} style={{ color: colors.brand }}>{part}</Text> : part)}
      {topic ? <Text style={{ color: colors.brand }}> #{topic.replace(/\s+/g, "")}</Text> : null}
    </Text>
  );
}

function PeopleGrid({
  people,
  reactions,
  pending,
  micRequested,
  onPerson,
}: {
  people: RoomSeat[];
  reactions: RoomReaction[];
  pending: MicAsk[];
  micRequested: boolean;
  onPerson?: (seat: RoomSeat) => void;
}) {
  const pendingIds = new Set(pending.map((ask) => ask.user_id));
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {people.map((seat) => {
        const burst = reactions.filter((item) => item.name === seat.name || (seat.you && item.name === "You")).slice(-1)[0];
        const hand = pendingIds.has(seat.id) || (seat.you && micRequested);
        return (
          <SpacePerson
            key={seat.id}
            seat={seat}
            emoji={burst ? roomEmoji(burst.kind)?.glyph : undefined}
            hand={hand}
            onPress={onPerson && !seat.you && seat.role !== "host" ? () => onPerson(seat) : undefined}
          />
        );
      })}
    </View>
  );
}

function SpacePerson({ seat, emoji, hand, onPress }: { seat: RoomSeat; emoji?: string; hand?: boolean; onPress?: () => void }) {
  const creator = seat.role === "host" || seat.role === "cohost" || !!seat.creatorMark;
  return (
    <Pressable disabled={!onPress} onPress={() => { hapticSelect(); onPress?.(); }} style={{ width: "25%", alignItems: "center", paddingVertical: 8, gap: 4 }} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${seat.you ? "You" : seat.name}, ${ROLE_LABEL[seat.role]}${seat.speaking ? ", speaking" : ""}${onPress ? ". Open speaker actions" : ""}`}>
      <View style={{ width: 74, height: 74, alignItems: "center", justifyContent: "center" }}>
        {seat.speaking ? <SpeakRing /> : null}
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.white }}>{seat.you ? "You" : initials(seat.name)}</Text>
        </View>
        {hand ? <Animated.Text entering={ZoomIn.springify().damping(12)} style={{ position: "absolute", right: -2, bottom: 2, fontSize: 18 }}>✋</Animated.Text> : null}
        {emoji ? <Text style={{ position: "absolute", right: -4, top: -2, fontSize: 18 }}>{emoji}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 84 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>{seat.you ? "You" : seat.name}</Text>
        {creator ? <CreatorMark mark={seat.creatorMark || seat.id} size={12} /> : null}
      </View>
      <RoleLine seat={seat} />
    </Pressable>
  );
}

function RoleLine({ seat }: { seat: RoomSeat }) {
  if (seat.speaking) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Equalizer />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.brand }}>{ROLE_LABEL[seat.role]}</Text>
      </View>
    );
  }
  if (seat.role === "listener") {
    return <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>Listener</Text>;
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      {seat.muted ? <MicrophoneSlash size={11} color={colors.coral} weight="fill" /> : <Microphone size={11} color={colors.inkSoft} />}
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>{ROLE_LABEL[seat.role]}</Text>
    </View>
  );
}

function SpeakRing() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = reduced ? 1 : withRepeat(withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.brand }, style]} />;
}

function Equalizer() {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1, height: 10 }}>
      {[0, 1, 2].map((index) => <EqBar key={index} index={index} />)}
    </View>
  );
}

function EqBar({ index }: { index: number }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(4);
  useEffect(() => {
    h.value = reduced ? 8 : withRepeat(withTiming(10, { duration: 280 + index * 90 }), -1, true);
  }, [h, index, reduced]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[{ width: 2, borderRadius: 1, backgroundColor: colors.brand }, style]} />;
}

function Carousel(props: RoomExperienceProps & {
  width: number;
  burstId: string;
  sparkError: string;
  sparkErrorId: string;
  onOpenUltra: () => void;
  onSpark: (id: string) => void;
  onClaim: () => void;
}) {
  const peek = 28;
  const slideWidth = Math.max(220, props.width - peek);
  const slides = props.products.length
    ? props.products
    : [{ name: props.description || "No product pinned", brand: props.topic }];
  const ultras = [...(props.ultras || [])].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const count = slides.length + ultras.length;
  const [page, setPage] = useState(0);
  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={slideWidth + 12}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / (slideWidth + 12)))}
        style={{ width: props.width }}
        contentContainerStyle={{ gap: 12, alignItems: "flex-start" }}
      >
        {slides.map((slide) => (
          <View key={slide.name} style={{ width: slideWidth, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12, gap: 6, backgroundColor: colors.stage }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{slide.brand ? `${slide.brand} ${slide.name}` : slide.name}</Text>
            {props.description && slide.name !== props.description ? (
              <Text numberOfLines={3} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{props.description}</Text>
            ) : null}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>Shared by {props.hostName}</Text>
            {props.canManage && props.onStartUltra ? (
              <PressScale label="Unmask this product" onPress={props.onOpenUltra}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brand }}>Unmask this product</Text>
              </PressScale>
            ) : null}
          </View>
        ))}
        {ultras.map((card) => (
          <View key={card.id} style={{ width: slideWidth }}>
            <UltraCard
              card={card}
              canPin={props.canManage}
              burst={props.burstId === card.id}
              shortfall={props.sparkErrorId === card.id ? props.sparkError : ""}
              onSpark={() => props.onSpark(card.id)}
              onPin={() => props.onPinUltra?.(card.id)}
              onNudge={() => props.onNudgeUltra?.(card)}
              onClaim={props.onClaim}
            />
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 5 }}>
        {Array.from({ length: Math.max(count, 1) }, (_, index) => (
          <View key={index} style={{ width: index === page ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: index === page ? colors.ink : colors.line }} />
        ))}
      </View>
    </View>
  );
}

function AnonymousRow(props: RoomExperienceProps) {
  const disabled = !props.canToggleAnonymous && props.phase !== "prejoin" && props.phase !== "connecting";
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Listen anonymously</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Listen anonymously"
          accessibilityState={{ checked: props.anonymous, disabled }}
          disabled={disabled}
          onPress={() => { hapticSelect(); props.onToggleAnonymous(!props.anonymous); }}
          style={{ width: 52, height: 32, borderRadius: 16, padding: 3, backgroundColor: props.anonymous ? colors.brandDeep : colors.line, alignItems: props.anonymous ? "flex-end" : "flex-start", justifyContent: "center" }}
        >
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gold }} />
        </Pressable>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
        While listening in anonymous mode, you will not be visible, able to speak, or send reactions. Your voice is not recorded.
      </Text>
    </View>
  );
}

function GradientButton({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy }} disabled={busy} onPress={() => { hapticSelect(); onPress(); }} style={{ borderRadius: 999, overflow: "hidden", minHeight: 52 }}>
      <LinearGradient colors={[colors.brand, colors.brandDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 52, alignItems: "center", justifyContent: "center" }}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.white }}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

function DockBar(props: RoomExperienceProps & {
  emojiOpen: boolean;
  noteCount: number;
  onPeople: () => void;
  onEmoji: () => void;
  onChat: () => void;
  onPick: (kind: RoomReactionKind) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 6, gap: 8 }}>
      {props.emojiOpen ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} exiting={reduced ? undefined : FadeOut.duration(160)} style={{ borderRadius: 22, backgroundColor: colors.stage, borderWidth: 1, borderColor: colors.line, padding: 10, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 }}>
          {ROOM_EMOJIS.map((item) => (
            <PressScale key={item.id} label={item.label} disabled={props.anonymous} onPress={() => props.onPick(item.id)} style={{ width: "18%", minHeight: 44, alignItems: "center", justifyContent: "center", opacity: props.anonymous ? 0.35 : 1 }}>
              <Text style={{ fontSize: 26 }}>{item.glyph}</Text>
            </PressScale>
          ))}
        </Animated.View>
      ) : null}
      <View pointerEvents="none" style={{ position: "absolute", right: 24, bottom: 78, alignItems: "flex-end", gap: 4 }}>
        {props.reactions.slice(-3).map((item) => <FloatEmoji key={item.id} glyph={roomEmoji(item.kind)?.glyph || ""} />)}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <PressScale
          label={props.canSpeak ? (props.micOn ? "Mute microphone" : "Turn microphone on") : props.micRequested ? "Mic requested" : "Request to speak"}
          disabled={!props.canSpeak && (props.micRequested || props.anonymous)}
          onPress={() => { props.canSpeak ? props.onToggleMic() : props.onRequestMic(); }}
          style={{ alignItems: "center", width: 72, opacity: !props.canSpeak && props.anonymous ? 0.4 : 1 }}
        >
          <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: colors.line, backgroundColor: props.canSpeak && props.micOn ? colors.brandDeep : colors.stage, alignItems: "center", justifyContent: "center" }}>
            {props.canSpeak && props.micOn ? <Microphone size={26} color={colors.white} weight="fill" /> : <MicrophoneSlash size={26} color={colors.ink} />}
          </View>
          {props.canSpeak ? null : <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, marginTop: 4 }}>{props.micRequested ? "Asked" : "Request"}</Text>}
        </PressScale>
        <View>
          <IconHit label={props.canManage && props.pendingMics.length ? `Guests, ${props.pendingMics.length} raised hands` : "Guests"} onPress={props.onPeople}><UsersThree size={26} color={colors.ink} /></IconHit>
          {props.canManage && props.pendingMics.length ? (
            <View pointerEvents="none" style={{ position: "absolute", top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.white }}>{props.pendingMics.length}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: "center" }}>
          <IconHit label="Reactions" onPress={props.onEmoji}><Heart size={26} color={colors.ink} /><Text style={{ position: "absolute", right: 6, top: 8, fontSize: 12, color: colors.brand }}>+</Text></IconHit>
          {props.reactionTotal ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>{props.reactionTotal}</Text> : null}
        </View>
        <View style={{ flex: 1 }} />
        <PressScale label={`Replies, ${props.noteCount}`} onPress={props.onChat} style={{ borderRadius: 999, overflow: "hidden" }}>
          <LinearGradient colors={[colors.brand, colors.brandDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ChatCircle size={18} color={colors.white} weight="fill" />
            <Tick value={props.noteCount} color={colors.white} />
          </LinearGradient>
        </PressScale>
      </View>
    </View>
  );
}

function MiniPlayer(props: RoomExperienceProps & { width: number; bottom: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : SlideInDown.springify().damping(16)} style={{ width: props.width, alignSelf: "center", marginBottom: props.bottom, marginHorizontal: 12, minHeight: 64, borderRadius: 18, backgroundColor: colors.stage, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={props.outputOn ? "Pause audio" : "Play audio"} onPress={() => { hapticSelect(); props.onToggleOutput(); }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.wine, alignItems: "center", justifyContent: "center" }}>
        {props.outputOn ? <Pause size={18} color={colors.ink} weight="fill" /> : <Play size={18} color={colors.ink} weight="fill" />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Expand Room" onPress={props.onExpand} style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{props.title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{label}</Text>
      </Pressable>
      <IconHit label="Close Room" onPress={props.onLeave}><X size={18} color={colors.ink} /></IconHit>
    </Animated.View>
  );
}

function Terminal(props: RoomExperienceProps) {
  const ended = props.phase === "ended";
  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.ink }}>{ended ? "This Room has ended." : "Could not join this Room."}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>{ended ? "The discussion is closed." : props.errorDetail || "Try again, or leave."}</Text>
      {props.onRetry && !ended ? <GradientButton label="Try again" onPress={props.onRetry} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Leave" onPress={props.onExit} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.coral }}>Leave</Text>
      </Pressable>
    </View>
  );
}

function MenuPopover({
  captions, reported, onClose, onSettings, onFeedback, onRules, onCaptions, onNotInterested, onReport, canEnd, onEnd, canStartUltra, onUltra,
}: {
  captions: boolean;
  reported: boolean;
  onClose: () => void;
  onSettings: () => void;
  onFeedback: () => void;
  onRules: () => void;
  onCaptions: () => void;
  onNotInterested: () => void;
  onReport: () => void;
  canEnd: boolean;
  onEnd?: () => void;
  canStartUltra?: boolean;
  onUltra?: () => void;
}) {
  const rows = [
    { label: "Adjust settings", icon: <Gear size={18} color={colors.ink} />, onPress: onSettings },
    { label: "Share feedback", icon: <ChatCircle size={18} color={colors.ink} />, onPress: onFeedback },
    { label: "View rules", icon: <ListBullets size={18} color={colors.ink} />, onPress: onRules },
  ];
  const reduced = useReducedMotion();
  return (
    <Pressable accessibilityLabel="Close menu" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
      <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(16)} exiting={reduced ? undefined : FadeOut.duration(140)} style={{ position: "absolute", top: 58, right: 16, width: 280, borderRadius: 16, backgroundColor: colors.wineDeep, borderWidth: 1, borderColor: colors.line, paddingVertical: 6 }}>
        {rows.map((row) => (
          <Pressable key={row.label} accessibilityRole="button" accessibilityLabel={row.label} onPress={() => { hapticSelect(); row.onPress(); }} style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}>{row.label}</Text>
            {row.icon}
          </Pressable>
        ))}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: captions }} accessibilityLabel="View captions" onPress={() => { hapticSelect(); onCaptions(); }} style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}>View captions</Text>
          <View style={{ width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: colors.inkSoft, alignItems: "center", justifyContent: "center" }}>{captions ? <Check size={12} color={colors.ink} /> : null}</View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Not interested in this Room" onPress={() => { hapticSelect(); onNotInterested(); }} style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}>Not interested in this Room</Text>
        </Pressable>
        {canStartUltra ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Unmask this product" onPress={() => { hapticSelect(); onUltra?.(); }} style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.brand }}>Unmask this product</Text>
          </Pressable>
        ) : null}
        {canEnd ? (
          <Pressable accessibilityRole="button" accessibilityLabel="End Room for everyone" onPress={() => { hapticSelect(); onEnd?.(); }} style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.coral }}>End Room for everyone</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Report this Room" onPress={() => { hapticSelect(); onReport(); }} style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.coral }}>{reported ? "Report noted" : "Report this Room"}</Text>
          <Flag size={16} color={colors.coral} />
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

function Rules({ onClose }: { onClose: () => void }) {
  return (
    <Pressable onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
      <View style={{ backgroundColor: colors.wine, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>Room rules</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>Stay on the product. The host decides who speaks. Anonymous listening stays off stage, off the mic, and out of reactions.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close rules" onPress={onClose} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.brand }}>Close</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function ShareSheet({ onClose, onShare, onCopy }: { onClose: () => void; onShare: () => void; onCopy: () => void }) {
  const rows = [
    { label: "Share via post", icon: <PaperPlaneRight size={20} color={colors.ink} />, onPress: onShare },
    { label: "Send via Chat", icon: <ChatCircle size={20} color={colors.ink} />, onPress: onShare },
    { label: "Copy Link", icon: <LinkSimple size={20} color={colors.ink} />, onPress: onCopy },
    { label: "Share via", icon: <ShareNetwork size={20} color={colors.ink} />, onPress: onShare },
  ];
  return (
    <Pressable accessibilityLabel="Close share" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: 430, backgroundColor: colors.wine, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8 }}>
        {rows.map((row) => (
          <Pressable key={row.label} accessibilityRole="button" accessibilityLabel={row.label} onPress={() => { hapticSelect(); row.onPress(); onClose(); }} style={{ minHeight: 52, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12 }}>
            {row.icon}
            <Text style={{ fontFamily: fonts.regular, fontSize: 17, color: colors.ink }}>{row.label}</Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

function PersonMenu({ seat, onClose, ...props }: RoomExperienceProps & { seat: RoomSeat; onClose: () => void }) {
  const cohost = seat.role === "cohost" || props.cohostIds.includes(seat.id);
  const speaker = seat.role === "speaker" || seat.role === "cohost";
  const actions = [
    seat.role === "listener" ? { label: "Invite to speak", run: () => props.onInviteSpeaker(seat.id) } : null,
    speaker ? { label: "Remove as speaker", run: () => props.onRemoveSpeaker(seat.id) } : null,
    speaker ? { label: "Mute", run: () => props.onMuteSpeaker(seat.id) } : null,
    cohost ? { label: "Remove co-host", run: () => props.onManage("remove_cohost", seat.id) } : { label: "Make co-host", run: () => props.onManage("add_cohost", seat.id) },
  ].filter(Boolean) as Array<{ label: string; run: () => void }>;
  return (
    <Pressable accessibilityLabel="Close speaker actions" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: 430, backgroundColor: colors.wine, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>{seat.name}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{ROLE_LABEL[seat.role]}</Text>
        {actions.map((action) => (
          <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => { hapticSelect(); action.run(); onClose(); }} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: action.label.startsWith("Remove") ? colors.coral : colors.ink }}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

function GuestsSheet(props: RoomExperienceProps & { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [guestMenu, setGuestMenu] = useState<RoomSeat | null>(null);
  const [filter, setFilter] = useState<"All" | "Co-hosts" | "Speakers" | "Listening">("All");
  const people = [...props.stage, ...props.audience].filter((seat) => {
    const hay = `${seat.name} ${seat.handle || ""}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (filter === "Co-hosts") return seat.role === "cohost";
    if (filter === "Speakers") return seat.role === "speaker" || seat.role === "host" || seat.role === "cohost";
    if (filter === "Listening") return seat.role === "listener";
    return true;
  });
  const sections = [
    { title: "Host", rows: people.filter((seat) => seat.role === "host") },
    { title: "Co-hosts", rows: people.filter((seat) => seat.role === "cohost"), meta: `${people.filter((seat) => seat.role === "cohost").length} co-hosts` },
    { title: "Speakers", rows: people.filter((seat) => seat.role === "speaker"), meta: `${people.filter((seat) => seat.role === "speaker").length} speakers` },
    { title: "Listening", rows: people.filter((seat) => seat.role === "listener") },
  ].filter((section) => filter === "All" || section.rows.length || (filter === "Co-hosts" && section.title === "Co-hosts") || (filter === "Speakers" && section.title === "Speakers") || (filter === "Listening" && section.title === "Listening"));
  return (
    <Pressable onPress={props.onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center" }}>
      <Pressable onPress={() => undefined} style={{ width: "100%", maxWidth: 430, maxHeight: "88%", backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 16 }}>
        <Text accessibilityRole="header" style={{ textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: colors.ink, paddingVertical: 14 }}>Guests</Text>
        <View style={{ marginHorizontal: 16, minHeight: 44, borderRadius: 999, backgroundColor: colors.stage, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}>
          <Text style={{ color: colors.inkSoft }}>⌕</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search for people and groups" placeholderTextColor={colors.inkSoft} accessibilityLabel="Search guests" style={{ flex: 1, minHeight: 44, color: colors.ink, fontFamily: fonts.regular, fontSize: 16, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null) }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}>
          {(["All", "Co-hosts", "Speakers", "Listening"] as const).map((item) => {
            const on = filter === item;
            return (
              <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { hapticSelect(); setFilter(item); }} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: on ? colors.ink : "transparent", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.wine : colors.ink }}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 12 }}>
          {props.canManage && props.pendingMics.length ? (
            <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.goldSoft }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.honeyInk }}>Raised hands · {props.pendingMics.length}</Text>
              {props.pendingMics.map((ask) => (
                <View key={ask.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{ask.display_name || "Listener"}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Approve ${ask.display_name || "listener"}`} onPress={() => props.onApproveMic(ask.user_id)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.brandDeep, justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>Approve</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Deny ${ask.display_name || "listener"}`} onPress={() => props.onDenyMic(ask.user_id)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Deny</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {sections.map((section) => (
            <View key={section.title} style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>{section.title}</Text>
              {section.meta ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{section.meta}</Text> : null}
              {section.rows.map((seat) => (
                <View key={seat.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.semibold, color: colors.white }}>{initials(seat.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{seat.you ? "You" : seat.name}</Text>
                      {seat.creatorMark || seat.role === "host" || seat.role === "cohost" ? <CreatorMark mark={seat.creatorMark || seat.id} size={14} /> : null}
                    </View>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{seat.handle ? `@${seat.handle}` : ROLE_LABEL[seat.role]}</Text>
                  </View>
                  {props.canManage && !seat.you && seat.role !== "host" ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${seat.name}`} onPress={() => setGuestMenu(seat)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brand }}>Manage</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
          {props.canManage ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Add a co-host</Text>
              {props.creators.map((person) => {
                const added = props.cohostIds.includes(person.user_id);
                const powers = props.cohostPermissions[person.user_id] || {};
                return (
                  <View key={person.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 }}>
                    <CreatorMark mark={person.creator_mark} size={28} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{person.display_name}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>@{person.handle}</Text>
                    </View>
                    {added ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${person.display_name}`} onPress={() => props.onManage("remove_cohost", person.user_id)} style={{ minHeight: 36, justifyContent: "center" }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.coral }}>Remove</Text>
                      </Pressable>
                    ) : (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${person.display_name}`} onPress={() => props.onManage("add_cohost", person.user_id)} style={{ minHeight: 36, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.brandDeep, justifyContent: "center" }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.white }}>Add</Text>
                      </Pressable>
                    )}
                    {added ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={powers.can_end ? "Revoke end" : "Allow end"} onPress={() => props.onManage(powers.can_end ? "revoke_end" : "grant_end", person.user_id)}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: powers.can_end ? colors.honeyInk : colors.inkSoft }}>End</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
        {guestMenu ? <PersonMenu seat={guestMenu} {...props} onClose={() => setGuestMenu(null)} /> : null}
      </Pressable>
    </Pressable>
  );
}

function ChatSheet(props: RoomExperienceProps & {
  mediaNote: string;
  burstId: string;
  sparkError: string;
  sparkErrorId: string;
  onMedia: () => void;
  onClose: () => void;
  initialPicker?: boolean;
  initialFull?: boolean;
  confirmPrivate?: boolean;
  initialDraft?: RoomTimeline | null;
  onOpenExperience: (item: RoomTimeline) => void;
  onDeeper: (item: RoomTimeline) => void;
  onSpark: (id: string) => void;
  onClaim: () => void;
}) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [attached, setAttached] = useState<RoomTimeline | null>(props.initialDraft || null);
  const [picker, setPicker] = useState(!!props.initialPicker);
  const [full, setFull] = useState(!!props.initialFull);
  const [loaded, setLoaded] = useState<RoomTimeline[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const loadTimelines = useRef(props.onLoadTimelines);
  loadTimelines.current = props.onLoadTimelines;
  useEffect(() => {
    let live = true;
    const pending = loadTimelines.current?.();
    if (pending) void pending.then((rows) => { if (live) setLoaded(rows); }).catch(() => { if (live) setLoaded([]); });
    return () => { live = false; };
  }, []);
  const items = loaded || props.timelines || [];
  function send() {
    const text = props.message.trim();
    if (!text && !attached) return;
    if (props.onSendDetail) props.onSendDetail(text, attached);
    else props.onSend();
    props.onMessage("");
    setAttached(null);
  }
  return (
    <Pressable onPress={props.onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center" }}>
      <PartialSheet onClose={props.onClose} expanded={full} onExpand={() => setFull(true)} onCollapse={() => setFull(false)}>
        <Pressable onPress={() => undefined} style={{ position: "relative", width: "100%", height: full ? height : undefined, maxHeight: full ? height : Math.min(height * 0.62, 560), backgroundColor: colors.wine, borderTopLeftRadius: full ? 0 : 22, borderTopRightRadius: full ? 0 : 22, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>Replies</Text>
            <PressScale label={full ? "Collapse replies" : "Expand replies"} onPress={() => setFull((value) => !value)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              {full ? <ArrowsIn size={18} color={colors.ink} /> : <ArrowsOut size={18} color={colors.ink} />}
            </PressScale>
          </View>
          <ScrollView style={{ maxHeight: full ? height - 180 : Math.min(height * 0.36, 320) }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
            {(props.ultras || []).map((card) => (
              <UltraCard
                key={card.id}
                card={card}
                canPin={props.canManage}
                burst={props.burstId === card.id}
                shortfall={props.sparkErrorId === card.id ? props.sparkError : ""}
                onSpark={() => props.onSpark(card.id)}
                onPin={() => props.onPinUltra?.(card.id)}
                onNudge={() => props.onNudgeUltra?.(card)}
                onClaim={props.onClaim}
              />
            ))}
            {props.notes.length ? props.notes.map((note) => (
              <Animated.View key={note.id} entering={reduced ? undefined : SlideInRight.springify().damping(18)} style={{ gap: 6 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{note.name}</Text>
                {note.text ? <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.inkSoft }}>{note.text}</Text> : null}
                {note.experience ? (
                  <ExperienceCard item={note.experience} onOpen={() => props.onOpenExperience(note.experience!)} onDeeper={() => props.onDeeper(note.experience!)} />
                ) : null}
              </Animated.View>
            )) : (props.ultras || []).length ? null : <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No replies yet. Add what you're hearing about the product.</Text>}
          </ScrollView>
          <View style={{ marginHorizontal: 12, marginTop: 8, gap: 8 }}>
            {attached ? <TimelineDraft item={attached} onPress={() => setPicker(true)} /> : <AttachPill pulsing onPress={() => setPicker(true)} />}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkSoft }}>Replies are visible to everyone in this Room and disappear when it ends. An Ultra Unmask stays.</Text>
            {props.message.trim() && !attached ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>Attach your timeline. It strengthens what you're saying.</Text> : null}
            <View style={{ minHeight: 52, borderRadius: 26, backgroundColor: colors.stage, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 8, gap: 4 }}>
              <TextInput
                value={props.message}
                onChangeText={props.onMessage}
                editable={!props.anonymous}
                placeholder={props.anonymous ? "Anonymous listening is quiet" : "Post your reply"}
                placeholderTextColor={colors.inkSoft}
                accessibilityLabel="Post your reply"
                onSubmitEditing={send}
                style={{ flex: 1, minHeight: 44, color: colors.ink, fontFamily: fonts.regular, fontSize: 16, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null) }}
              />
              <PressScale label="Send reply" onPress={send} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <PaperPlaneRight size={18} color={colors.brand} />
              </PressScale>
            </View>
          </View>
          <TimelinePicker
            open={picker}
            items={items}
            busy={creating}
            error={createError}
            onClose={() => setPicker(false)}
            onMakePublic={props.onPublishTimeline}
            confirmPrivate={props.confirmPrivate}
            onPick={(item) => { setAttached(item); setLoaded((current) => current ? current.map((row) => row.id === item.id ? item : row) : current); setPicker(false); }}
            onCreate={() => {
              if (!props.onCreateTimeline) {
                setCreateError("Start a timeline from the product page, then attach it here.");
                return;
              }
              setCreating(true);
              setCreateError("");
              void props.onCreateTimeline().then((item) => {
                if (item) { setAttached(item); setLoaded((current) => current ? [item, ...current.filter((row) => row.id !== item.id)] : [item]); setPicker(false); }
              }).catch((error: unknown) => {
                setCreateError(error instanceof Error ? error.message : "Could not start a timeline.");
              }).finally(() => setCreating(false));
            }}
          />
        </Pressable>
      </PartialSheet>
    </Pressable>
  );
}
