import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CaretDown,
  ChatCircle,
  Check,
  DotsThree,
  Flag,
  Gear,
  Heart,
  ImageSquare,
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

export type RoomNote = { id: string; name: string; text: string };
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
  canManage: boolean;
  creators: CohostPerson[];
  cohostIds: string[];
  cohostPermissions: Record<string, CohostPowers>;
  onManage: (action: string, userId?: string) => void;
  notice?: string;
  audioHost?: ReactNode;
};

const ROLE_LABEL = { host: "Host", cohost: "Co-host", speaker: "Speaker", listener: "Listener" } as const;

export function RoomExperience(props: RoomExperienceProps) {
  useUnmaskTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const sheetWidth = Math.min(width, 480);
  const [menu, setMenu] = useState(false);
  const [share, setShare] = useState(false);
  const [guests, setGuests] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [chat, setChat] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [reported, setReported] = useState(false);
  const [rules, setRules] = useState(false);
  const [mediaNote, setMediaNote] = useState("");
  const prejoin = props.phase === "prejoin" || props.phase === "connecting";
  const people = useMemo(() => [...props.stage, ...props.audience], [props.stage, props.audience]);
  const extraListeners = Math.max(props.anonymousCount, Math.max(0, props.listenerCount - people.length));

  if (props.minimized && props.phase !== "prejoin") {
    return (
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end" }}>
        {props.audioHost}
        <MiniPlayer {...props} width={sheetWidth} bottom={Math.max(insets.bottom, 10)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
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
          maxHeight: height * 0.94,
          backgroundColor: colors.wine,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          overflow: "hidden",
          paddingBottom: Math.max(insets.bottom, 8),
        }}
      >
        <View style={{ alignItems: "center", paddingTop: 8 }}>
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
        </View>
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
        />
        {props.phase === "error" || props.phase === "ended" ? (
          <Terminal {...props} />
        ) : (
          <ScrollView style={{ maxHeight: Math.max(220, height * 0.94 - (prejoin ? 430 : 250)) }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 14 }}>
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
            {!prejoin ? <Carousel {...props} width={sheetWidth - 32} /> : null}
            {!props.canHear && props.phase === "live" ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Tap to hear the Room" onPress={props.onStartAudio} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.brand }}>Tap to hear the Room</Text>
              </Pressable>
            ) : null}
            <PeopleGrid
              people={people.length ? people : hostFallback(props)}
              reactions={props.reactions}
              pending={props.pendingMics}
              micRequested={props.micRequested}
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
              {recordingNotice(props.recordingStatus)} <Text style={{ color: colors.brand }}>Learn more</Text>
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
          />
        ) : null}
        {rules ? <Rules onClose={() => setRules(false)} /> : null}
      </Animated.View>
      {share ? <ShareSheet onClose={() => setShare(false)} onShare={props.onShare} onCopy={props.onCopyLink} /> : null}
      {guests ? <GuestsSheet {...props} onClose={() => setGuests(false)} /> : null}
      {chat ? (
        <ChatSheet
          {...props}
          mediaNote={mediaNote}
          onMedia={() => setMediaNote("Photos and GIFs aren't part of this Room.")}
          onClose={() => setChat(false)}
        />
      ) : null}
    </View>
  );
}

function recordingNotice(status?: string | null) {
  const copy = recordingCopy(status);
  if (copy.active && status === "recording") return "This Room is being recorded. Your voice could be in a replay and heard after it ends.";
  if (copy.failed) return "Recording didn't start. Your voice is not being saved right now.";
  return "The host might save this recording. Your voice could be in a replay and heard by more people after this Room ends.";
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
}: {
  prejoin: boolean;
  connecting: boolean;
  onClose: () => void;
  onShare: () => void;
  onMenu: () => void;
  onLeave: () => void;
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
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { hapticSelect(); onPress(); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      {children}
    </Pressable>
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
}: {
  people: RoomSeat[];
  reactions: RoomReaction[];
  pending: MicAsk[];
  micRequested: boolean;
}) {
  const pendingIds = new Set(pending.map((ask) => ask.user_id));
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {people.map((seat) => {
        const burst = reactions.filter((item) => item.name === seat.name || (seat.you && item.name === "You")).slice(-1)[0];
        const hand = pendingIds.has(seat.id) || (seat.you && micRequested);
        return <SpacePerson key={seat.id} seat={seat} emoji={burst ? roomEmoji(burst.kind)?.glyph : undefined} hand={hand} />;
      })}
    </View>
  );
}

function SpacePerson({ seat, emoji, hand }: { seat: RoomSeat; emoji?: string; hand?: boolean }) {
  const creator = seat.role === "host" || seat.role === "cohost" || !!seat.creatorMark;
  return (
    <View style={{ width: "25%", alignItems: "center", paddingVertical: 8, gap: 4 }} accessibilityLabel={`${seat.you ? "You" : seat.name}, ${ROLE_LABEL[seat.role]}${seat.speaking ? ", speaking" : ""}`}>
      <View style={{ width: 74, height: 74, alignItems: "center", justifyContent: "center" }}>
        {seat.speaking ? <SpeakRing /> : null}
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.white }}>{seat.you ? "You" : initials(seat.name)}</Text>
        </View>
        {hand ? <Text style={{ position: "absolute", right: -2, bottom: 2, fontSize: 18 }}>✋</Text> : null}
        {emoji ? <Text style={{ position: "absolute", right: -4, top: -2, fontSize: 18 }}>{emoji}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 84 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>{seat.you ? "You" : seat.name}</Text>
        {creator ? <CreatorMark mark={seat.creatorMark || seat.id} size={12} /> : null}
      </View>
      <RoleLine seat={seat} />
    </View>
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

function Carousel(props: RoomExperienceProps & { width: number }) {
  const slides = props.products.length
    ? props.products
    : [{ name: props.description || "No product pinned", brand: props.topic }];
  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: props.width }}>
        {slides.map((slide) => (
          <View key={slide.name} style={{ width: props.width, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12, gap: 6, backgroundColor: colors.stage }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{slide.brand ? `${slide.brand} ${slide.name}` : slide.name}</Text>
            {props.description && slide.name !== props.description ? (
              <Text numberOfLines={3} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{props.description}</Text>
            ) : null}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>Shared by {props.hostName}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 5 }}>
        {slides.map((slide, index) => (
          <View key={slide.name} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: index === 0 ? colors.ink : colors.line }} />
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
        While listening in anonymous mode, you will not be visible, able to speak, or send reactions. <Text style={{ color: colors.brand }}>Learn more</Text>
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
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 6, gap: 8 }}>
      {props.emojiOpen ? (
        <View style={{ borderRadius: 22, backgroundColor: colors.stage, borderWidth: 1, borderColor: colors.line, padding: 10, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 }}>
          {ROOM_EMOJIS.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} disabled={props.anonymous} onPress={() => props.onPick(item.id)} style={{ width: "18%", minHeight: 44, alignItems: "center", justifyContent: "center", opacity: props.anonymous ? 0.35 : 1 }}>
              <Text style={{ fontSize: 26 }}>{item.glyph}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.canSpeak ? (props.micOn ? "Mute microphone" : "Turn microphone on") : props.micRequested ? "Mic requested" : "Request to speak"}
          disabled={!props.canSpeak && (props.micRequested || props.anonymous)}
          onPress={() => { hapticSelect(); props.canSpeak ? props.onToggleMic() : props.onRequestMic(); }}
          style={{ alignItems: "center", width: 72, opacity: !props.canSpeak && props.anonymous ? 0.4 : 1 }}
        >
          <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: colors.line, backgroundColor: props.canSpeak && props.micOn ? colors.brandDeep : colors.stage, alignItems: "center", justifyContent: "center" }}>
            {props.canSpeak && props.micOn ? <Microphone size={26} color={colors.white} weight="fill" /> : <MicrophoneSlash size={26} color={colors.ink} />}
          </View>
          {props.canSpeak ? null : <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, marginTop: 4 }}>{props.micRequested ? "Asked" : "Request"}</Text>}
        </Pressable>
        <IconHit label="Guests" onPress={props.onPeople}><UsersThree size={26} color={colors.ink} /></IconHit>
        <IconHit label="Reactions" onPress={props.onEmoji}><Heart size={26} color={colors.ink} /><Text style={{ position: "absolute", right: 6, top: 8, fontSize: 12, color: colors.brand }}>+</Text></IconHit>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Replies, ${props.noteCount}`} onPress={() => { hapticSelect(); props.onChat(); }} style={{ borderRadius: 999, overflow: "hidden" }}>
          <LinearGradient colors={[colors.brand, colors.brandDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ChatCircle size={18} color={colors.white} weight="fill" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>{props.noteCount}</Text>
          </LinearGradient>
        </Pressable>
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
  return (
    <View style={{ width: props.width, alignSelf: "center", marginBottom: props.bottom, marginHorizontal: 12, minHeight: 64, borderRadius: 18, backgroundColor: colors.stage, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={props.outputOn ? "Pause audio" : "Play audio"} onPress={() => { hapticSelect(); props.onToggleOutput(); }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.wine, alignItems: "center", justifyContent: "center" }}>
        {props.outputOn ? <Pause size={18} color={colors.ink} weight="fill" /> : <Play size={18} color={colors.ink} weight="fill" />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Expand Room" onPress={props.onExpand} style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{props.title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{label}</Text>
      </Pressable>
      <IconHit label="Close Room" onPress={props.onLeave}><X size={18} color={colors.ink} /></IconHit>
    </View>
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
  captions, reported, onClose, onSettings, onFeedback, onRules, onCaptions, onNotInterested, onReport, canEnd, onEnd,
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
}) {
  const rows = [
    { label: "Adjust settings", icon: <Gear size={18} color={colors.ink} />, onPress: onSettings },
    { label: "Share feedback", icon: <ChatCircle size={18} color={colors.ink} />, onPress: onFeedback },
    { label: "View rules", icon: <ListBullets size={18} color={colors.ink} />, onPress: onRules },
  ];
  return (
    <Pressable accessibilityLabel="Close menu" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
      <View style={{ position: "absolute", top: 58, right: 16, width: 280, borderRadius: 16, backgroundColor: colors.wineDeep, borderWidth: 1, borderColor: colors.line, paddingVertical: 6 }}>
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
        {canEnd ? (
          <Pressable accessibilityRole="button" accessibilityLabel="End Room for everyone" onPress={() => { hapticSelect(); onEnd?.(); }} style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.coral }}>End Room for everyone</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Report this Room" onPress={() => { hapticSelect(); onReport(); }} style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.coral }}>{reported ? "Report noted" : "Report this Room"}</Text>
          <Flag size={16} color={colors.coral} />
        </Pressable>
      </View>
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
      <View style={{ width: "100%", maxWidth: 480, backgroundColor: colors.wine, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8 }}>
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

function GuestsSheet(props: RoomExperienceProps & { onClose: () => void }) {
  const [query, setQuery] = useState("");
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
      <Pressable onPress={() => undefined} style={{ width: "100%", maxWidth: 480, maxHeight: "88%", backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 16 }}>
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
          {props.pendingMics.length && props.canManage ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Wants to speak</Text>
              {props.pendingMics.map((ask) => (
                <View key={ask.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink }}>{ask.display_name || "Listener"}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Bring ${ask.display_name || "listener"} up`} onPress={() => props.onApproveMic(ask.user_id)} style={{ minHeight: 36, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.brandDeep, justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.white }}>Bring up</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => props.onDenyMic(ask.user_id)} style={{ minHeight: 36, paddingHorizontal: 10, justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft }}>Not now</Text>
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
      </Pressable>
    </Pressable>
  );
}

function ChatSheet(props: RoomExperienceProps & { mediaNote: string; onMedia: () => void; onClose: () => void }) {
  return (
    <Pressable onPress={props.onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center" }}>
      <Pressable onPress={() => undefined} style={{ width: "100%", maxWidth: 480, maxHeight: "80%", backgroundColor: colors.wine, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 10 }}>
        <Text style={{ textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: colors.ink, paddingVertical: 12 }}>Replies</Text>
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {props.notes.length ? props.notes.map((note) => (
            <View key={note.id} style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{note.name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.inkSoft }}>{note.text}</Text>
            </View>
          )) : <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>No replies yet. Add what you're hearing about the product.</Text>}
        </ScrollView>
        {props.mediaNote ? <Text style={{ paddingHorizontal: 16, paddingTop: 8, fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{props.mediaNote}</Text> : null}
        <View style={{ margin: 12, minHeight: 52, borderRadius: 26, backgroundColor: colors.stage, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 8, gap: 8 }}>
          <TextInput
            value={props.message}
            onChangeText={props.onMessage}
            editable={!props.anonymous}
            placeholder={props.anonymous ? "Anonymous listening is quiet" : "Post your reply"}
            placeholderTextColor={colors.inkSoft}
            accessibilityLabel="Post your reply"
            onSubmitEditing={props.onSend}
            style={{ flex: 1, minHeight: 44, color: colors.ink, fontFamily: fonts.regular, fontSize: 16, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null) }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Add image" onPress={props.onMedia} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <ImageSquare size={20} color={colors.inkSoft} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Add GIF" onPress={props.onMedia} style={{ minWidth: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.inkSoft }}>GIF</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Send reply" onPress={() => { hapticSelect(); props.onSend(); }} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <PaperPlaneRight size={18} color={colors.brand} />
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}
