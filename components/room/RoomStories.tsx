import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { ArrowsIn, ArrowsOut, Clock, Globe, Lightning, Lock } from "@/components/icons";
import { SparkBurst } from "@/components/unmask-ui/SparkBurst";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect, hapticSuccess } from "@/lib/haptics";
import { photoUrl } from "@/lib/living/api";
import { COMPANY_FALLBACK, ULTRA_PATHS, ULTRA_QUESTIONS, type RoomTimeline, type RoomUltra, type TimelineMoment } from "@/lib/room/cards";
import { ULTRA_UNMASK_SPARK_GOAL, combinedSupport, sparkProgress } from "@/lib/unmask/status";

import { PartialSheet, PressScale, RisingBar } from "./motion";

const ULTRA_ART = require("@/assets/brand/ultra-veil.jpg");
const SPARK_PRESETS = [10, 25, 50, 100];
const THUNDER_PRESETS = [0, 1, 2];

function DoubleBolt({ size = 14 }: { size?: number }) {
  return (
    <View style={{ width: size + 8, height: size, justifyContent: "center" }}>
      <Lightning size={size} color={colors.gold} weight="fill" style={{ position: "absolute", left: 0 }} />
      <Lightning size={size} color={colors.honey} weight="fill" style={{ position: "absolute", left: 6 }} />
    </View>
  );
}

function dateLabel(iso?: string | null) {
  if (!iso) return "Date not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AttachPill({
  label,
  pulsing,
  onPress,
}: {
  label?: string;
  pulsing?: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (!pulsing || reduced) {
      glow.value = 1;
      return;
    }
    glow.value = withRepeat(withTiming(0.45, { duration: 700 }), 6, true);
  }, [glow, pulsing, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <PressScale label={label ? "Timeline attached" : "Attach timeline"} onPress={onPress}>
      <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: 999, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold }, pulsing ? style : null]}>
        <Clock size={16} color={colors.honey} weight="fill" />
        <Text numberOfLines={1} style={{ maxWidth: 180, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{label || "Attach timeline"}</Text>
      </Animated.View>
    </PressScale>
  );
}

export function TimelineDraft({ item, onPress }: { item: RoomTimeline; onPress: () => void }) {
  const summary = [item.duration, item.frequency, item.reactions[0]].filter((part): part is string => !!part).join(" · ");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Attached timeline, ${item.productName}`} onPress={onPress} style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.stage }}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: 44, height: 44, borderRadius: 8 }} /> : <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.hiSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: fonts.bold, color: colors.brand }}>{item.productName.slice(0, 1)}</Text></View>}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{item.productName}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{item.author}'s timeline{summary ? ` · ${summary}` : ""}</Text>
      </View>
    </Pressable>
  );
}

export function ExperienceCard({ item, onOpen, onDeeper }: { item: RoomTimeline; onOpen: () => void; onDeeper: () => void }) {
  const reduced = useReducedMotion();
  const facts = [item.frequency, item.skinType, item.duration].filter((fact): fact is string => !!fact);
  const chips = item.reactions.filter((chip) => chip && chip !== item.frequency);
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.stage, overflow: "hidden" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.author}'s timeline for ${item.productName}`} onPress={onOpen} style={{ flexDirection: "row", gap: 10, padding: 10 }}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={{ width: 52, height: 52, borderRadius: 10 }} />
          ) : (
            <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.hiSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.bold, color: colors.brand }}>{item.productName.slice(0, 1)}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ paddingHorizontal: 6, minHeight: 18, borderRadius: 4, backgroundColor: colors.goldSoft, justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.honeyInk }}>EXPERIENCE</Text>
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{item.author}'s timeline</Text>
            </View>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{item.productName}</Text>
            {facts.length ? <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{facts.join(" · ")}</Text> : null}
            {chips.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {chips.slice(0, 3).map((chip) => (
                  <Text key={chip} style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.brand }}>{chip}</Text>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>
        <PressScale label="Unmask this" onPress={onDeeper}>
          <View style={{ minHeight: 40, borderTopWidth: 1, borderTopColor: colors.line, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
            <Lightning size={14} color={colors.brand} weight="fill" />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.brand }}>Unmask this</Text>
          </View>
        </PressScale>
      </View>
    </Animated.View>
  );
}

export function TimelinePicker({
  open,
  items,
  onClose,
  onPick,
  onCreate,
  onMakePublic,
  confirmPrivate,
  busy,
  error,
}: {
  open: boolean;
  items: RoomTimeline[];
  onClose: () => void;
  onPick: (item: RoomTimeline) => void;
  onCreate: () => void;
  onMakePublic?: (item: RoomTimeline) => Promise<RoomTimeline | null>;
  confirmPrivate?: boolean;
  busy?: boolean;
  error?: string;
}) {
  const [pending, setPending] = useState<RoomTimeline | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [localError, setLocalError] = useState("");
  const primed = useRef(false);
  useEffect(() => {
    if (!open) { primed.current = false; setPending(null); setLocalError(""); return; }
    if (confirmPrivate && !primed.current) {
      primed.current = true;
      const hidden = items.find((item) => item.visibility !== "public");
      if (hidden) setPending(hidden);
    }
  }, [confirmPrivate, items, open]);
  if (!open) return null;
  function choose(item: RoomTimeline) {
    if (item.visibility === "public") onPick(item);
    else setPending(item);
  }
  return (
    <Pressable accessibilityLabel="Close timelines" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", alignItems: "center", zIndex: 8, backgroundColor: "rgba(0,0,0,0.35)" }}>
      <PartialSheet onClose={onClose}>
        <View style={{ width: "100%", maxHeight: 420, backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 16 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink, paddingHorizontal: 16, paddingBottom: 8 }}>{pending ? "Make this public?" : "Your product timeline"}</Text>
          {pending ? (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink }}>This timeline is {pending.visibility === "followers" ? "only for followers" : "private"}. Make it public so people in the Room can see your experience.</Text>
              {localError || error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{localError || error}</Text> : null}
              <PressScale label="Make public and attach" disabled={publishing || busy} onPress={() => {
                if (!onMakePublic) { setLocalError("This timeline can't be made public from here."); return; }
                setPublishing(true);
                setLocalError("");
                void onMakePublic(pending).then((next) => { if (next) onPick(next); }).catch((cause: unknown) => {
                  setLocalError(cause instanceof Error ? cause.message : "Could not make this timeline public.");
                }).finally(() => setPublishing(false));
              }}>
                <View style={{ minHeight: 44, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: fonts.bold, color: colors.white }}>{publishing ? "Making it public…" : "Make public and attach"}</Text>
                </View>
              </PressScale>
              <PressScale label="Cancel" onPress={() => setPending(null)}><Text style={{ fontFamily: fonts.semibold, color: colors.ink, textAlign: "center" }}>Cancel</Text></PressScale>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 4, paddingBottom: 8 }}>
              {items.length ? items.map((item) => (
                <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Attach ${item.productName}`} onPress={() => choose(item)} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: 44, height: 44, borderRadius: 8 }} /> : <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.hiSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: fonts.bold, color: colors.brand }}>{item.productName.slice(0, 1)}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{item.productName}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{[item.brand, item.duration, item.frequency].filter(Boolean).join(" · ")}</Text>
                  </View>
                  {item.visibility === "public" ? <Globe size={16} color={colors.inkSoft} /> : <Lock size={16} color={colors.honeyInk} />}
                </Pressable>
              )) : <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>No timeline yet. Start one for the product in this Room.</Text>}
              {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{error}</Text> : null}
              <PressScale label="Start a timeline" onPress={onCreate} disabled={busy} style={{ paddingTop: 8 }}>
                <Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>{busy ? "Starting…" : "Start a timeline"}</Text>
              </PressScale>
            </ScrollView>
          )}
        </View>
      </PartialSheet>
    </Pressable>
  );
}

function MomentPhoto({ moment }: { moment: TimelineMoment }) {
  const [uri, setUri] = useState(moment.photoUrl || "");
  useEffect(() => {
    if (moment.photoUrl || !moment.photoPath) return;
    let live = true;
    void photoUrl(moment.photoPath).then((next) => { if (live) setUri(next); }).catch(() => { if (live) setUri(""); });
    return () => { live = false; };
  }, [moment.photoPath, moment.photoUrl]);
  if (uri) return <Image source={{ uri }} accessibilityLabel="Photo from this chapter" style={{ width: "100%", height: 160, borderRadius: 12 }} />;
  if (moment.photoPath) return <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>A photo was saved with this chapter. It isn’t available in the Room.</Text>;
  return null;
}

export function ExperienceSheet({
  item,
  full,
  onToggleFull,
  onClose,
  onDeeper,
}: {
  item: RoomTimeline | null;
  full?: boolean;
  onToggleFull?: () => void;
  onClose: () => void;
  onDeeper: () => void;
}) {
  const { height } = useWindowDimensions();
  if (!item) return null;
  const entries = item.entries?.length ? item.entries : [{ id: item.id, at: "", note: item.outcome || "No dated chapter was shared with this timeline.", reaction: null }];
  return (
    <Pressable accessibilityLabel="Close experience" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center", zIndex: 5 }}>
      <PartialSheet onClose={onClose}>
        <View style={{ width: "100%", height: full ? height : undefined, maxHeight: full ? height : height * 0.78, backgroundColor: colors.wine, borderTopLeftRadius: full ? 0 : 22, borderTopRightRadius: full ? 0 : 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{item.author}'s timeline</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{item.productName} · {item.duration}</Text>
            </View>
            <PressScale label={full ? "Collapse timeline" : "Expand timeline"} onPress={onToggleFull || onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              {full ? <ArrowsIn size={20} color={colors.ink} /> : <ArrowsOut size={20} color={colors.ink} />}
            </PressScale>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 180, borderRadius: 16 }} /> : null}
            {entries.map((entry, index) => (
              <View key={entry.id} style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ alignItems: "center", width: 16 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold }} />
                  {index < entries.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.line }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 6, paddingBottom: 8 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.honeyInk }}>{dateLabel(entry.at)}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink }}>{entry.note}</Text>
                  {entry.reaction ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{entry.reaction}</Text> : null}
                  <MomentPhoto moment={entry} />
                </View>
              </View>
            ))}
            <PressScale label="Unmask this" onPress={onDeeper}>
              <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.bold, color: colors.white }}>Unmask this</Text>
              </View>
            </PressScale>
          </ScrollView>
        </View>
      </PartialSheet>
    </Pressable>
  );
}

export function UltraCard({
  card,
  onSpark,
  onPin,
  onNudge,
  onClaim,
  canPin,
  burst,
  shortfall,
}: {
  card: RoomUltra;
  onSpark: () => void;
  onPin?: () => void;
  onNudge?: () => void;
  onClaim?: () => void;
  canPin?: boolean;
  burst?: boolean;
  shortfall?: string;
}) {
  const reduced = useReducedMotion();
  const progress = sparkProgress(combinedSupport(card.sparks, card.thunder || 0), card.goal || ULTRA_UNMASK_SPARK_GOAL);
  const path = ULTRA_PATHS.find((item) => item.id === card.path)?.label || "Ultra Unmask";
  return (
    <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(16)} style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: card.pinned ? colors.gold : colors.line, backgroundColor: colors.stage }}>
      <Image source={ULTRA_ART} accessibilityLabel="Ultra Unmask" style={{ width: "100%", height: 92 }} />
      <View style={{ padding: 12, gap: 8, backgroundColor: colors.wine }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.brand }}>{card.pinned ? "Highlighted · " : ""}{path}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={{ width: 48, height: 48, borderRadius: 12 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{card.title}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{card.productName} · {card.author}</Text>
          </View>
        </View>
        {card.path === "company" ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft }}>{COMPANY_FALLBACK}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Lightning size={14} color={colors.gold} weight="fill" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}>{card.sparks.toLocaleString()} Sparks</Text>
          </View>
          {card.thunder ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <DoubleBolt />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.honeyInk }}>{card.thunder.toLocaleString()} Thunder {card.thunder === 1 ? "Spark" : "Sparks"}</Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}>{progress.remaining.toLocaleString()} to the line</Text>
        </View>
        <RisingBar ratio={progress.ratio} />
        <View style={{ flexDirection: "row" }}>
          {card.supporters.slice(0, 5).map((person, index) => (
            <View key={`${person.name}-${index}`} style={{ width: 24, height: 24, borderRadius: 12, marginRight: -6, backgroundColor: colors.brandDeep, borderWidth: 1, borderColor: colors.wine, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.white }}>{person.name.slice(0, 1)}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <PressScale label="Add Sparks" onPress={onSpark}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, minHeight: 36, borderRadius: 999, backgroundColor: colors.goldSoft }}>
              <Lightning size={14} color={colors.honeyInk} weight="fill" />
              <Text style={{ fontFamily: fonts.semibold, color: colors.honeyInk }}>Add Sparks</Text>
            </View>
          </PressScale>
          {canPin && onPin ? <PressScale label="Highlight this Ultra Unmask" onPress={onPin}><Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>Highlight</Text></PressScale> : null}
          {canPin && onNudge ? <PressScale label="Ask for more detail" onPress={onNudge}><Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>Ask for more detail</Text></PressScale> : null}
        </View>
        {shortfall ? (
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{shortfall}</Text>
            {onClaim ? <PressScale label="Claim monthly Sparks" onPress={onClaim}><Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>Claim monthly Sparks</Text></PressScale> : null}
          </View>
        ) : null}
        <SparkBurst show={!!burst} />
      </View>
    </Animated.View>
  );
}

export function UltraCreate({
  open,
  step = 0,
  productName,
  timeline,
  balance,
  thunderBalance,
  busy,
  error,
  onClose,
  onCreate,
  onClaim,
}: {
  open: boolean;
  step?: 0 | 1;
  productName: string;
  timeline?: RoomTimeline | null;
  balance: number | null;
  thunderBalance?: number | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (who: "company" | "expert", question: string, sparks: number, thunder: number) => void;
  onClaim: () => void;
}) {
  const { height } = useWindowDimensions();
  const [question, setQuestion] = useState<string>(ULTRA_QUESTIONS[0]);
  const [custom, setCustom] = useState(false);
  const [own, setOwn] = useState("");
  const [who, setWho] = useState<"company" | "expert">("company");
  const [sparks, setSparks] = useState(10);
  const [thunder, setThunder] = useState(0);
  const [page, setPage] = useState<0 | 1>(step > 0 ? 1 : 0);
  useEffect(() => {
    if (!open) return;
    setQuestion(ULTRA_QUESTIONS[0]);
    setCustom(false);
    setOwn("");
    setWho("company");
    setSparks(10);
    setThunder(0);
    setPage(step > 0 ? 1 : 0);
  }, [open, step]);
  if (!open) return null;
  const asked = (custom ? own.trim() : question).trim();
  const sparkShort = sparks > 0 && balance != null && sparks > balance;
  const thunderShort = thunder > 0 && thunderBalance != null && thunder > thunderBalance;
  const ready = asked.length >= 8 && (sparks >= 10 || thunder >= 1) && !sparkShort && !thunderShort;
  return (
    <Pressable accessibilityLabel="Close Ultra Unmask" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center", zIndex: 6 }}>
      <PartialSheet onClose={onClose}>
        <View style={{ width: "100%", maxHeight: height * 0.86, backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
            <Image source={ULTRA_ART} accessibilityLabel="Ultra Unmask" style={{ width: "100%", height: 96, borderRadius: 16 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.ink }}>Unmask this</Text>
            {page === 0 ? (
              <>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.honeyInk }}>WHAT DO YOU WANT TO KNOW?</Text>
                {timeline ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>{timeline.author}'s timeline · {timeline.productName}</Text> : <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>{productName}</Text>}
                {ULTRA_QUESTIONS.map((item) => {
                  const selected = !custom && question === item;
                  return (
                    <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { hapticSelect(); setCustom(false); setQuestion(item); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.hiSoft : colors.stage, paddingHorizontal: 14, justifyContent: "center" }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{item}</Text>
                    </Pressable>
                  );
                })}
                <Pressable accessibilityRole="button" accessibilityState={{ selected: custom }} onPress={() => { hapticSelect(); setCustom(true); }} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: custom ? colors.brand : colors.line, backgroundColor: custom ? colors.hiSoft : colors.stage, paddingHorizontal: 14, justifyContent: "center" }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Write your own</Text>
                </Pressable>
                {custom ? <TextInput value={own} onChangeText={setOwn} placeholder="Your question" placeholderTextColor={colors.inkSoft} accessibilityLabel="Your question" style={{ minHeight: 48, borderRadius: 12, backgroundColor: colors.stage, color: colors.ink, paddingHorizontal: 12, fontFamily: fonts.regular }} /> : null}
                <PressScale label="Choose who should answer" onPress={() => setPage(1)} disabled={asked.length < 8}>
                  <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.white }}>Choose who should answer</Text>
                  </View>
                </PressScale>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.honeyInk }}>WHO SHOULD ANSWER?</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.ink }}>{asked}</Text>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: who === "company" }} onPress={() => { hapticSelect(); setWho("company"); }} style={{ borderRadius: 16, borderWidth: 1, borderColor: who === "company" ? colors.brand : colors.line, backgroundColor: who === "company" ? colors.hiSoft : colors.stage, padding: 14, gap: 6 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Ask the company</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>Put the question to the brand</Text>
                  {who === "company" ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>{COMPANY_FALLBACK}</Text> : null}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: who === "expert" }} onPress={() => { hapticSelect(); setWho("expert"); }} style={{ borderRadius: 16, borderWidth: 1, borderColor: who === "expert" ? colors.brand : colors.line, backgroundColor: who === "expert" ? colors.hiSoft : colors.stage, padding: 14, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Ask an expert</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>Bring in someone who knows</Text>
                </Pressable>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.honeyInk }}>SPARKS</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {SPARK_PRESETS.map((preset) => {
                    const on = sparks === preset;
                    return (
                      <Pressable key={preset} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { hapticSelect(); setSparks(preset); }} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.gold : colors.line, backgroundColor: on ? colors.goldSoft : colors.stage, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Lightning size={14} color={colors.gold} weight="fill" />
                        <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{preset}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {THUNDER_PRESETS.map((preset) => {
                    const on = thunder === preset;
                    return (
                      <Pressable key={preset} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={preset ? `${preset} Thunder Sparks` : "No Thunder Sparks"} onPress={() => { hapticSelect(); setThunder(preset); }} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.gold : colors.line, backgroundColor: on ? colors.goldSoft : colors.stage, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <DoubleBolt />
                        <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{preset === 0 ? "None" : preset}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>{balance == null ? "Sparks balance is still loading." : `${balance.toLocaleString()} Sparks`}{thunderBalance == null ? "" : ` · ${thunderBalance.toLocaleString()} Thunder Sparks`}. One Thunder Spark counts as 100 Sparks toward the line. Neither buys the answer.</Text>
                {sparkShort || thunderShort ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>Not enough for that opening. Claim this month's Sparks without leaving the Room.</Text> : null}
                {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{error}</Text> : null}
                <PressScale label="Claim monthly Sparks" onPress={onClaim}><Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>Claim monthly Sparks</Text></PressScale>
                <PressScale label={busy ? "Sending" : "Unmask it"} disabled={!ready || busy} onPress={() => { hapticSuccess(); onCreate(who, asked, sparks >= 10 ? sparks : 0, thunder); }}>
                  <View style={{ minHeight: 52, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center", opacity: ready ? 1 : 0.45 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.white }}>{busy ? "Sending…" : "Unmask it"}</Text>
                  </View>
                </PressScale>
              </>
            )}
          </ScrollView>
        </View>
      </PartialSheet>
    </Pressable>
  );
}
