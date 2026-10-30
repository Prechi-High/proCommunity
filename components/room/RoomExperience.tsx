import { useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ArrowsLeftRight,
  BookmarkSimple,
  CaretDown,
  CaretUp,
  ChatCircleDots,
  Checks,
  DotsThree,
  EyeSlash,
  HandPalm,
  Microphone,
  MicrophoneSlash,
  Package,
  Question,
  ShareNetwork,
  SpeakerHigh,
  Waveform,
  X,
} from "@/components/icons";
import { ActionSheet } from "@/components/unmask-ui/ActionSheet";
import { AppShell } from "@/components/unmask-ui/Shell";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect, hapticSuccess } from "@/lib/haptics";
import { peopleLabel, recordingCopy } from "@/lib/room/context";
import type { RoomProductChip, RoomReactionKind, RoomSeat } from "@/lib/room/types";
import { useUnmaskTheme } from "@/lib/useUnmaskTheme";

import { AudioBars, HostFace, ListenerPip, SpeakingAvatar } from "./SpeakingAvatar";

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

const REACTIONS: Array<{
  kind: RoomReactionKind;
  label: string;
  hint: string;
  Icon: typeof Checks;
}> = [
  { kind: "same", label: "Same", hint: "I've experienced this too", Icon: Checks },
  { kind: "differs", label: "Differs", hint: "My experience was different", Icon: ArrowsLeftRight },
  { kind: "clarify", label: "Clarify", hint: "This needs a clearer account", Icon: Question },
  { kind: "keep", label: "Keep", hint: "Worth keeping with the evidence", Icon: BookmarkSimple },
];

export type RoomExperienceProps = {
  phase: "connecting" | "live" | "ended" | "error";
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
  reactionCounts: Record<RoomReactionKind, number>;
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
  onShare: () => void;
  onToggleAnonymous: (next: boolean) => void;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
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

export function RoomExperience(props: RoomExperienceProps) {
  useUnmaskTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  const [reacting, setReacting] = useState(false);
  const recording = recordingCopy(props.recordingStatus);
  const speakingSeat = props.stage.find((seat) => seat.speaking);
  const speakingLabel = speakingSeat ? (speakingSeat.you ? "You are speaking" : `${speakingSeat.name} is speaking`) : "";
  const live = props.phase === "live";

  const footer = live ? (
    <View style={{ gap: 10, paddingBottom: Math.max(0, insets.bottom - 8) }}>
      {props.minimized ? (
        <NowListeningBar {...props} speakingLabel={speakingLabel} onMore={() => setMore(true)} />
      ) : (
        <>
          {!props.canHear && !props.canSpeak ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tap to hear the Room"
              onPress={() => {
                hapticSelect();
                props.onStartAudio();
              }}
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: colors.brandDeep,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                opacity: pressed ? 0.86 : 1,
              })}
            >
              <SpeakerHigh size={18} color={colors.white} weight="fill" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>Tap to hear the Room</Text>
            </Pressable>
          ) : null}
          {reacting ? (
            <ReactionTray
              anonymous={props.anonymous}
              onPick={(kind) => {
                if (props.anonymous) return;
                hapticSelect();
                props.onReact(kind);
                setReacting(false);
              }}
            />
          ) : null}
          <Dock
            {...props}
            reacting={reacting}
            onToggleReactions={() => setReacting((open) => !open)}
            onMore={() => setMore(true)}
          />
        </>
      )}
    </View>
  ) : null;

  return (
    <AppShell back scroll={live && !props.minimized} footer={footer}>
      {props.audioHost}
      <View style={{ gap: 18 }}>
        {props.sample ? <SampleBanner /> : null}
        {props.phase === "connecting" ? <ConnectingState /> : null}
        {props.phase === "error" ? (
          <TerminalState
            title="Could not join this Room."
            detail={props.errorDetail || "The discussion didn't open. You can try again, or go back to the list."}
            primary={props.onRetry ? "Try again" : undefined}
            onPrimary={props.onRetry}
            secondary="Back to Rooms"
            onSecondary={props.onExit}
            tone="error"
          />
        ) : null}
        {props.phase === "ended" ? (
          <TerminalState
            title="This Room has ended."
            detail={
              recording.label === "Recorded"
                ? "The discussion is closed. A recording was saved with the host."
                : "The discussion is closed. If a recording was made, it stays with the host."
            }
            primary="Back to Rooms"
            onPrimary={props.onExit}
            tone="ended"
          />
        ) : null}
        {live && props.minimized ? (
          <View style={{ gap: 8, paddingVertical: 12 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}>You're still in this Room.</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
              Audio continues while the stage is tucked away. Expand to see who's speaking.
            </Text>
          </View>
        ) : null}
        {live && !props.minimized ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(220)} style={{ gap: 18 }}>
            <RoomHeader
              {...props}
              recordingLabel={recording.label}
              recordingActive={recording.active}
              recordingFailed={recording.failed}
              speakingLabel={speakingLabel}
              onMinimize={() => {
                hapticSelect();
                props.onMinimize();
              }}
            />
            {props.invited ? <InviteBanner onDismiss={props.onDismissInvite} /> : null}
            {props.micRequested && !props.canSpeak ? (
              <Notice
                title="Your hand is up."
                detail="The host can bring you onto the stage. You'll get the mic if they do."
              />
            ) : null}
            {props.micDenied ? (
              <Notice title="The mic stayed on stage." detail="You can keep listening, or ask again in a moment." />
            ) : null}
            {props.pendingMics.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${props.pendingMics.length} people want to speak. Review requests.`}
                onPress={() => setMore(true)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.goldSoft,
                  gap: 4,
                })}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.honeyInk }}>
                  {props.pendingMics.length === 1 ? "1 person wants to speak" : `${props.pendingMics.length} people want to speak`}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.honeyInk }}>Review the request and bring them up, or leave them listening.</Text>
              </Pressable>
            ) : null}
            {props.notice ? <Notice title={props.notice} /> : null}
            <View style={{ flexDirection: wide ? "row" : "column", gap: 16, alignItems: "stretch" }}>
              <View style={{ flex: wide ? 1.2 : undefined, gap: 16 }}>
                <Stage stage={props.stage} reactions={props.reactions} speaking={!!speakingSeat} />
                <Audience audience={props.audience} anonymousCount={props.anonymousCount} />
                <ReactionReadout counts={props.reactionCounts} anonymous={props.anonymous} />
              </View>
              <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
                <Notes
                  notes={props.notes}
                  message={props.message}
                  anonymous={props.anonymous}
                  onMessage={props.onMessage}
                  onSend={props.onSend}
                />
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
      <ActionSheet open={more} title="Room" onClose={() => setMore(false)}>
        <MoreSheet {...props} onClose={() => setMore(false)} />
      </ActionSheet>
    </AppShell>
  );
}

function SampleBanner() {
  return (
    <View accessibilityRole="text" style={{ padding: 12, borderRadius: 14, backgroundColor: colors.goldSoft }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.honeyInk }}>
        Sample layout. These people and this product are not a live Room.
      </Text>
    </View>
  );
}

function ConnectingState() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Joining the Room" style={{ gap: 16, paddingVertical: 28 }}>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {[72, 72, 72].map((size, index) => (
          <View key={index} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.mist }} />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.serifBold, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.5 }}>
        Taking your seat
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>
        Joining the Room. Audio starts when the connection is ready.
      </Text>
    </View>
  );
}

function TerminalState({
  title,
  detail,
  primary,
  onPrimary,
  secondary,
  onSecondary,
  tone,
}: {
  title: string;
  detail: string;
  primary?: string;
  onPrimary?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  tone: "error" | "ended";
}) {
  const bg = tone === "error" ? colors.coralSoft : colors.stage;
  const fg = tone === "error" ? colors.coral : colors.ink;
  return (
    <View style={{ gap: 14, padding: 20, borderRadius: 24, backgroundColor: bg }}>
      <Waveform size={28} color={fg} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.serifBold, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.4 }}>
        {title}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft }}>{detail}</Text>
      {primary && onPrimary ? <TextButton label={primary} onPress={onPrimary} /> : null}
      {secondary && onSecondary ? <TextButton label={secondary} tone="quiet" onPress={onSecondary} /> : null}
    </View>
  );
}

function RoomHeader(props: RoomExperienceProps & {
  recordingLabel: string;
  recordingActive: boolean;
  recordingFailed: boolean;
  speakingLabel: string;
  onMinimize: () => void;
}) {
  const router = useRouter();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          accessibilityLabel={props.recordingLabel}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            minHeight: 28,
            borderRadius: 999,
            backgroundColor: props.recordingFailed ? colors.coralSoft : props.recordingActive ? colors.coralSoft : colors.mist,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: props.recordingActive ? colors.coral : props.recordingFailed ? colors.coral : colors.bone3,
            }}
          />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: props.recordingFailed ? colors.coral : colors.ink }}>
            {props.recordingLabel}
          </Text>
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft }}>
          {peopleLabel(props.listenerCount)} here
          {props.anonymousCount ? ` · ${props.anonymousCount} anonymous` : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minimize Room"
          onPress={props.onMinimize}
          hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.stage, alignItems: "center", justifyContent: "center" }}
        >
          <CaretDown size={18} color={colors.ink} weight="bold" />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.serifBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: colors.ink }}>
        {props.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <HostFace name={props.hostName} uri={props.hostAvatar} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{props.hostName}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>
            Host{props.hostHandle ? ` · @${props.hostHandle}` : ""} · Creator
          </Text>
        </View>
        <CreatorMark mark={props.hostMark || props.hostName} size={32} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {props.topic ? <ContextChip label={props.topic} /> : null}
        {props.products.length ? (
          props.products.map((product) => (
            <ContextChip
              key={product.name}
              label={product.brand ? `${product.brand} ${product.name}` : product.name}
              icon
              onPress={
                product.id
                  ? () => router.push({ pathname: "/product/[id]", params: { id: product.id! } } as Href)
                  : undefined
              }
            />
          ))
        ) : (
          <ContextChip label="No product pinned" muted />
        )}
      </View>
      {props.description ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>{props.description}</Text>
      ) : null}
      <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <AudioBars active={!!props.speakingLabel} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: props.speakingLabel ? colors.ink : colors.inkSoft }}>
          {props.speakingLabel || "The stage is open. Speakers light up as they talk."}
        </Text>
      </View>
    </View>
  );
}

function ContextChip({
  label,
  muted,
  icon,
  onPress,
}: {
  label: string;
  muted?: boolean;
  icon?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        minHeight: 36,
        borderRadius: 999,
        backgroundColor: muted ? colors.mist : colors.hiSoft,
      }}
    >
      {icon ? <Package size={14} color={muted ? colors.inkSoft : colors.hiInk} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: muted ? colors.inkSoft : colors.hiInk }}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Product, ${label}`} onPress={onPress} style={{ minHeight: 44, justifyContent: "center" }}>
      {body}
    </Pressable>
  );
}

function InviteBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={{ padding: 14, borderRadius: 18, backgroundColor: colors.sageSoft, gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.sageInk }}>You're invited to speak.</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.sageInk }}>
        The host brought you onto the stage. Your mic is on until you mute it.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss invitation"
        onPress={() => {
          hapticSuccess();
          onDismiss();
        }}
        style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.sageInk }}>I'm here</Text>
      </Pressable>
    </View>
  );
}

function Notice({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={{ padding: 14, borderRadius: 18, backgroundColor: colors.stage, gap: 4 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{title}</Text>
      {detail ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>{detail}</Text> : null}
    </View>
  );
}

function Stage({
  stage,
  reactions,
  speaking,
}: {
  stage: RoomSeat[];
  reactions: RoomReaction[];
  speaking: boolean;
}) {
  return (
    <View
      style={{
        borderRadius: 28,
        backgroundColor: colors.stage,
        borderWidth: 1,
        borderColor: colors.line,
        paddingTop: 8,
        paddingBottom: 18,
        paddingHorizontal: 8,
        overflow: "hidden",
        gap: 8,
      }}
    >
      <View style={{ height: 3, borderRadius: 3, marginHorizontal: 12, backgroundColor: speaking ? colors.gold : colors.line }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 28 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8, color: colors.inkSoft }}>ON STAGE</Text>
        <View style={{ flex: 1 }} />
        {reactions.slice(-2).map((item) => {
          const meta = REACTIONS.find((reaction) => reaction.kind === item.kind);
          if (!meta) return null;
          const Icon = meta.Icon;
          return (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                minHeight: 28,
                borderRadius: 999,
                backgroundColor: colors.lac,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Icon size={14} color={colors.brand} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>{meta.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {stage.map((seat) => (
          <SpeakingAvatar key={seat.id} seat={seat} size={seat.role === "host" ? 88 : 76} />
        ))}
      </View>
    </View>
  );
}

function Audience({
  audience,
  anonymousCount,
}: {
  audience: RoomSeat[];
  anonymousCount: number;
}) {
  const shown = audience.slice(0, 16);
  const extra = Math.max(0, audience.length - shown.length);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Listening</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>
          {peopleLabel(audience.length + anonymousCount)}
        </Text>
      </View>
      {shown.length || anonymousCount ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {shown.map((seat) => (
            <ListenerPip key={seat.id} seat={seat} />
          ))}
          {extra ? (
            <View style={{ paddingHorizontal: 10, minHeight: 40, borderRadius: 20, backgroundColor: colors.mist, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft }}>+{extra}</Text>
            </View>
          ) : null}
          {anonymousCount ? (
            <View
              accessibilityLabel={`${anonymousCount} anonymous ${anonymousCount === 1 ? "listener" : "listeners"}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                minHeight: 40,
                borderRadius: 20,
                backgroundColor: colors.mist,
              }}
            >
              <EyeSlash size={14} color={colors.inkSoft} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft }}>
                {anonymousCount} anonymous
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
          The audience is still arriving. Seats fill in as people join.
        </Text>
      )}
    </View>
  );
}

function ReactionReadout({
  counts,
  anonymous,
}: {
  counts: Record<RoomReactionKind, number>;
  anonymous: boolean;
}) {
  const total = REACTIONS.reduce((sum, item) => sum + (counts[item.kind] || 0), 0);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>What the room recognises</Text>
      {anonymous ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>
          Reactions are off while you listen anonymously.
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {REACTIONS.map((item) => {
          const Icon = item.Icon;
          const count = counts[item.kind] || 0;
          return (
            <View
              key={item.kind}
              accessibilityLabel={`${item.label}, ${count}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                minHeight: 36,
                borderRadius: 999,
                backgroundColor: count ? colors.hiSoft : colors.mist,
              }}
            >
              <Icon size={14} color={count ? colors.hiInk : colors.inkSoft} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: count ? colors.hiInk : colors.inkSoft }}>
                {item.label} {count ? count : ""}
              </Text>
            </View>
          );
        })}
      </View>
      {!total && !anonymous ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>
          Mark what matches your experience. It stays with this discussion, not a public feed.
        </Text>
      ) : null}
    </View>
  );
}

function Notes({
  notes,
  message,
  anonymous,
  onMessage,
  onSend,
}: {
  notes: RoomNote[];
  message: string;
  anonymous: boolean;
  onMessage: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.lac, overflow: "hidden" }}>
      <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ChatCircleDots size={18} color={colors.brand} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Alongside the audio</Text>
      </View>
      <View style={{ padding: 14, gap: 12, minHeight: 88 }}>
        {notes.length ? (
          notes.slice(-8).map((note) => (
            <View key={note.id} style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.brand }}>{note.name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink }}>{note.text}</Text>
            </View>
          ))
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>
            {anonymous
              ? "Anonymous listening is quiet. Notes and reactions stay off."
              : "Add a short note about the product. This is not a separate feed."}
          </Text>
        )}
      </View>
      {anonymous ? null : (
        <View style={{ flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
          <TextInput
            value={message}
            onChangeText={onMessage}
            onSubmitEditing={onSend}
            placeholder="Add what you're hearing"
            placeholderTextColor={colors.inkSoft}
            accessibilityLabel="Note for the room"
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 14,
              backgroundColor: colors.stage,
              color: colors.ink,
              paddingHorizontal: 12,
              fontFamily: fonts.regular,
              fontSize: 15,
              ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send note"
            onPress={() => {
              hapticSelect();
              onSend();
            }}
            style={({ pressed }) => ({
              minWidth: 64,
              minHeight: 44,
              borderRadius: 14,
              backgroundColor: colors.brandDeep,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.86 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ReactionTray({
  anonymous,
  onPick,
}: {
  anonymous: boolean;
  onPick: (kind: RoomReactionKind) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {REACTIONS.map((item) => {
        const Icon = item.Icon;
        return (
          <Pressable
            key={item.kind}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint={anonymous ? "Turn off anonymous listening to react" : item.hint}
            accessibilityState={{ disabled: anonymous }}
            disabled={anonymous}
            onPress={() => onPick(item.kind)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 64,
              borderRadius: 16,
              backgroundColor: colors.hiSoft,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              opacity: anonymous ? 0.4 : pressed ? 0.75 : 1,
            })}
          >
            <Icon size={18} color={colors.hiInk} weight="bold" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.hiInk }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Dock(
  props: RoomExperienceProps & {
    reacting: boolean;
    onToggleReactions: () => void;
    onMore: () => void;
  },
) {
  const requestLabel = props.micRequested ? "Asked" : "Request";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        gap: 2,
        padding: 4,
        borderRadius: 22,
        backgroundColor: colors.stage,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {props.canSpeak ? (
        <DockButton
          label={props.micOn ? "Mute" : "Mic"}
          accessibilityLabel={props.micOn ? "Mute microphone" : "Turn microphone on"}
          active={props.micOn}
          onPress={props.onToggleMic}
          icon={props.micOn ? <Microphone size={20} color={colors.white} weight="fill" /> : <MicrophoneSlash size={20} color={colors.coral} />}
          iconBg={props.micOn ? colors.brandDeep : colors.coralSoft}
        />
      ) : (
        <DockButton
          label={requestLabel}
          accessibilityLabel={props.micRequested ? "Mic requested" : "Request to speak"}
          accessibilityHint={props.anonymous ? "Turn off anonymous listening to ask for the mic" : "Ask the host to bring you on stage"}
          disabled={props.micRequested || props.anonymous}
          active={props.micRequested}
          onPress={props.onRequestMic}
          icon={<HandPalm size={20} color={props.micRequested ? colors.honeyInk : colors.ink} />}
          iconBg={props.micRequested ? colors.goldSoft : colors.lac}
        />
      )}
      <DockButton
        label="Leave"
        accessibilityLabel="Leave quietly"
        accessibilityHint="Leave this Room without ending it for everyone else"
        onPress={props.onLeave}
        icon={<X size={18} color={colors.ink} />}
        iconBg={colors.lac}
      />
      <DockButton
        label="React"
        accessibilityLabel="Reactions"
        active={props.reacting}
        onPress={props.onToggleReactions}
        icon={<Checks size={18} color={props.reacting ? colors.hiInk : colors.ink} />}
        iconBg={props.reacting ? colors.hiSoft : colors.lac}
      />
      <DockButton
        label="Share"
        accessibilityLabel="Share this Room"
        onPress={props.onShare}
        icon={<ShareNetwork size={18} color={colors.ink} />}
        iconBg={colors.lac}
      />
      <DockButton
        label="More"
        accessibilityLabel="More room controls"
        onPress={props.onMore}
        icon={<DotsThree size={20} color={colors.ink} weight="bold" />}
        iconBg={colors.lac}
      />
    </View>
  );
}

function DockButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  icon,
  iconBg,
  active,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  icon: ReactNode;
  iconBg: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={() => {
        if (!disabled) {
          hapticSelect();
          onPress();
        }
      }}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 48,
        minHeight: 62,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 16,
        opacity: disabled ? 0.42 : pressed ? 0.72 : 1,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11, color: active ? colors.ink : colors.inkSoft }}>
        {label}
      </Text>
    </Pressable>
  );
}

function NowListeningBar(props: RoomExperienceProps & { speakingLabel: string; onMore: () => void }) {
  const host = props.stage.find((seat) => seat.role === "host");
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Now listening. ${props.title}. ${props.speakingLabel || "Waiting for someone to speak."}`}
      style={{
        minHeight: 72,
        borderRadius: 22,
        backgroundColor: colors.stage,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
        <AudioBars active={!!props.speakingLabel} height={28} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, color: colors.brand }}>NOW LISTENING</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{props.title}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>
          {props.speakingLabel || `${host?.name || props.hostName} · ${peopleLabel(props.listenerCount)}`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Expand Room"
        onPress={() => {
          hapticSelect();
          props.onExpand();
        }}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lac, alignItems: "center", justifyContent: "center" }}
      >
        <CaretUp size={18} color={colors.ink} weight="bold" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave quietly"
        onPress={() => {
          hapticSelect();
          props.onLeave();
        }}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lac, alignItems: "center", justifyContent: "center" }}
      >
        <X size={16} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function MoreSheet(props: RoomExperienceProps & { onClose: () => void }) {
  return (
    <View style={{ gap: 16 }}>
      {props.canToggleAnonymous ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Listen anonymously</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>
              {props.anonymous
                ? "Your name is hidden. You can't speak, react, or send notes."
                : "Your name is visible to the room. Turn this on to sit in the audience quietly."}
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Listen anonymously"
            accessibilityState={{ checked: props.anonymous }}
            onPress={() => {
              hapticSelect();
              props.onToggleAnonymous(!props.anonymous);
            }}
            style={{ width: 56, minHeight: 44, justifyContent: "center" }}
          >
            <View
              style={{
                width: 52,
                height: 32,
                borderRadius: 16,
                padding: 3,
                backgroundColor: props.anonymous ? colors.brandDeep : colors.line,
                alignItems: props.anonymous ? "flex-end" : "flex-start",
              }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gold }} />
            </View>
          </Pressable>
        </View>
      ) : null}

      {props.pendingMics.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Mic requests</Text>
          {props.pendingMics.map((ask) => (
            <View key={ask.user_id} style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.ink }}>
                {ask.display_name || "A listener"} wants to speak.
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextButton label="Bring up" onPress={() => props.onApproveMic(ask.user_id)} />
                <TextButton label="Not now" tone="quiet" onPress={() => props.onDenyMic(ask.user_id)} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {props.canManage ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Co-hosts</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>
            Only active Unmask Creators can be co-hosts. The host keeps final control unless a permission is delegated.
          </Text>
          {props.creators.length ? (
            props.creators.map((person) => {
              const added = props.cohostIds.includes(person.user_id);
              const powers = props.cohostPermissions[person.user_id] || {};
              return (
                <View key={person.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
                  <CreatorMark mark={person.creator_mark} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{person.display_name}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>@{person.handle}</Text>
                  </View>
                  {added ? (
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${person.display_name} as co-host`}
                        onPress={() => props.onManage("remove_cohost", person.user_id)}
                        style={{ minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: colors.stage, alignItems: "center", justifyContent: "center" }}
                      >
                        <X size={16} color={colors.brand} />
                      </Pressable>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <TinyToggle
                          label={powers.can_end ? "Can end" : "End"}
                          on={!!powers.can_end}
                          onPress={() => props.onManage(powers.can_end ? "revoke_end" : "grant_end", person.user_id)}
                        />
                        <TinyToggle
                          label={powers.can_manage_cohosts ? "Can manage" : "Manage"}
                          on={!!powers.can_manage_cohosts}
                          tone="sage"
                          onPress={() =>
                            props.onManage(
                              powers.can_manage_cohosts ? "revoke_cohost_management" : "grant_cohost_management",
                              person.user_id,
                            )
                          }
                        />
                      </View>
                    </View>
                  ) : (
                    <TextButton label="Add" onPress={() => props.onManage("add_cohost", person.user_id)} />
                  )}
                </View>
              );
            })
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
              No other active Unmask Creators are available right now.
            </Text>
          )}
        </View>
      ) : null}

      <TextButton
        label="Minimize"
        tone="quiet"
        onPress={() => {
          props.onMinimize();
          props.onClose();
        }}
      />
      <TextButton
        label="Leave quietly"
        tone="quiet"
        onPress={() => {
          props.onClose();
          props.onLeave();
        }}
      />
      {props.onEnd ? (
        <TextButton
          label="End Room for everyone"
          tone="danger"
          onPress={() => {
            props.onClose();
            props.onEnd?.();
          }}
        />
      ) : null}
    </View>
  );
}

function TinyToggle({
  label,
  on,
  onPress,
  tone = "gold",
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  tone?: "gold" | "sage";
}) {
  const bg = on ? (tone === "sage" ? colors.sageSoft : colors.goldSoft) : colors.stage;
  const fg = on ? (tone === "sage" ? colors.sageInk : colors.honeyInk) : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={{ minHeight: 36, paddingHorizontal: 8, borderRadius: 10, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: fg }}>{label}</Text>
    </Pressable>
  );
}

function TextButton({
  label,
  onPress,
  tone = "solid",
}: {
  label: string;
  onPress: () => void;
  tone?: "solid" | "quiet" | "danger";
}) {
  const bg = tone === "solid" ? colors.brandDeep : tone === "danger" ? colors.coralSoft : colors.stage;
  const fg = tone === "solid" ? colors.white : tone === "danger" ? colors.coral : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: fg }}>{label}</Text>
    </Pressable>
  );
}
