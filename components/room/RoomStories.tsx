import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { ArrowsIn, ArrowsOut, Clock, Lightning, MagnifyingGlass, Megaphone, SealCheck } from "@/components/icons";
import { SparkBurst } from "@/components/unmask-ui/SparkBurst";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect, hapticSuccess } from "@/lib/haptics";
import { photoUrl } from "@/lib/living/api";
import { ULTRA_PATHS, type RoomTimeline, type RoomUltra, type TimelineMoment, type UltraPath } from "@/lib/room/cards";
import { ULTRA_UNMASK_SPARK_GOAL, sparkProgress } from "@/lib/unmask/status";

import { PartialSheet, PressScale, RisingBar } from "./motion";

const ULTRA_ART = require("@/assets/brand/ultra-veil.jpg");
const PATH_ICON = { why: MagnifyingGlass, company: Megaphone, expert: SealCheck } as const;
const SPARK_PRESETS = [10, 25, 50, 100];

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

export function ExperienceCard({ item, onOpen, onDeeper }: { item: RoomTimeline; onOpen: () => void; onDeeper: () => void }) {
  const reduced = useReducedMotion();
  const marks = item.entries?.length ? item.entries : item.reactions.map((chip, index) => ({ id: chip, at: "", note: chip, reaction: chip }));
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
      <View style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.stage }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10 }}>
          <View style={{ paddingHorizontal: 8, minHeight: 22, borderRadius: 6, backgroundColor: colors.goldSoft, justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4, color: colors.honeyInk }}>EXPERIENCE</Text>
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}>{item.duration}</Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <PressScale label="Unmask this" onPress={onDeeper}>
            <View style={{ minHeight: 40, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
              <Lightning size={16} color={colors.white} weight="fill" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.white }}>Unmask this</Text>
            </View>
          </PressScale>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.author}'s timeline for ${item.productName}`} onPress={onOpen} style={{ padding: 12, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>{item.author.slice(0, 1)}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{item.author}'s timeline</Text>
          </View>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} accessibilityLabel={item.productName} style={{ width: "100%", height: 88, borderRadius: 14 }} />
          ) : (
            <View style={{ height: 88, borderRadius: 14, backgroundColor: colors.hiSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 22, color: colors.brand }}>{item.productName.slice(0, 1)}</Text>
            </View>
          )}
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{item.productName}</Text>
        </Pressable>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 0 }}>
            {marks.slice(0, 6).map((mark, index) => (
              <View key={mark.id || index} style={{ flex: 1, alignItems: "center" }}>
                <View style={{ height: 3, alignSelf: "stretch", backgroundColor: colors.brand, opacity: 0.35 + (index % 3) * 0.2 }} />
                <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: -6, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.stage }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {item.reactions.slice(0, 3).map((chip) => (
              <View key={chip} style={{ paddingHorizontal: 8, minHeight: 24, borderRadius: 999, backgroundColor: colors.hiSoft, justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.hiInk }}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
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
  busy,
  error,
}: {
  open: boolean;
  items: RoomTimeline[];
  onClose: () => void;
  onPick: (item: RoomTimeline) => void;
  onCreate: () => void;
  busy?: boolean;
  error?: string;
}) {
  if (!open) return null;
  return (
    <Pressable accessibilityLabel="Close timelines" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", alignItems: "center", zIndex: 4 }}>
      <PartialSheet onClose={onClose}>
        <View style={{ width: "100%", maxHeight: "78%", backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 12 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, paddingHorizontal: 16, paddingBottom: 8 }}>Your product timeline</Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
            {items.length ? items.map((item) => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Attach ${item.productName}`} onPress={() => onPick(item)} style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.stage }}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} accessibilityLabel="" style={{ width: "100%", height: 112 }} />
                ) : (
                  <View style={{ height: 96, alignItems: "center", justifyContent: "center", backgroundColor: colors.hiSoft }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.brand }}>{item.productName.slice(0, 1)}</Text>
                  </View>
                )}
                <View style={{ padding: 12, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.ink }}>{item.productName}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{[item.brand, item.duration].filter(Boolean).join(" · ")}</Text>
                </View>
              </Pressable>
            )) : <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>No timeline yet. Start one for the product in this Room.</Text>}
            {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{error}</Text> : null}
          </ScrollView>
          <PressScale label="Start a timeline" onPress={onCreate} disabled={busy} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>{busy ? "Starting…" : "Start a timeline"}</Text>
          </PressScale>
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
  const progress = sparkProgress(card.sparks, card.goal || ULTRA_UNMASK_SPARK_GOAL);
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Lightning size={14} color={colors.gold} weight="fill" />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}>{card.sparks.toLocaleString()} of {progress.goal.toLocaleString()} Sparks · {progress.remaining.toLocaleString()} to the line</Text>
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

function SealButton({ disabled, onSeal }: { disabled?: boolean; onSeal: () => void }) {
  const reduced = useReducedMotion();
  const [holding, setHolding] = useState(false);
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }
  function begin() {
    if (disabled) return;
    if (reduced) {
      hapticSuccess();
      onSeal();
      return;
    }
    setHolding(true);
    progress.value = withTiming(1, { duration: 880 });
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks += 1;
      hapticSelect();
      if (ticks >= 4) {
        stop();
        setHolding(false);
        hapticSuccess();
        onSeal();
      }
    }, 220);
  }
  function cancel() {
    if (reduced || !timer.current) return;
    stop();
    setHolding(false);
    progress.value = withTiming(0, { duration: 140 });
  }
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={reduced ? "Seal this Ultra Unmask" : "Hold to seal this Ultra Unmask"} disabled={disabled} onPressIn={begin} onPressOut={cancel}>
      <View style={{ minHeight: 56, borderRadius: 999, overflow: "hidden", backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.gold }, bar]} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>{holding ? "Sealing your case" : reduced ? "Seal this Ultra Unmask" : "Hold to seal"}</Text>
      </View>
    </Pressable>
  );
}

export function UltraCreate({
  open,
  step = 0,
  productName,
  timeline,
  balance,
  busy,
  error,
  onClose,
  onCreate,
  onClaim,
}: {
  open: boolean;
  step?: 0 | 1 | 2;
  productName: string;
  timeline?: RoomTimeline | null;
  balance: number | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (path: UltraPath, amount: number) => void;
  onClaim: () => void;
}) {
  const { height } = useWindowDimensions();
  const [path, setPath] = useState<UltraPath>("why");
  const [amount, setAmount] = useState(10);
  const [page, setPage] = useState<0 | 1 | 2>(step);
  useEffect(() => { if (open) { setPath("why"); setAmount(10); setPage(step); } }, [open, step]);
  if (!open) return null;
  const short = balance != null && amount > balance;
  return (
    <Pressable accessibilityLabel="Close Ultra Unmask" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center", zIndex: 6 }}>
      <PartialSheet onClose={onClose}>
        <View style={{ width: "100%", maxHeight: height * 0.86, backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
            <Image source={ULTRA_ART} accessibilityLabel="Ultra Unmask" style={{ width: "100%", height: 120, borderRadius: 16 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.ink }}>Unmask this</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.inkSoft }}>Your timeline is the evidence. Sparks move the question toward the line where a creator can take it on. They do not buy a conclusion.</Text>
            {page === 0 ? (
              <>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.honeyInk }}>YOUR CASE</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{timeline ? `${timeline.author}'s timeline · ${timeline.productName}` : productName}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{timeline?.outcome || "No timeline attached. The question still stands."}</Text>
                {ULTRA_PATHS.map((item) => {
                  const Icon = PATH_ICON[item.id];
                  const selected = path === item.id;
                  return (
                    <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { hapticSelect(); setPath(item.id); }} style={{ minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.hiSoft : colors.stage, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <Icon size={22} color={selected ? colors.brand : colors.ink} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{item.label}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{item.detail}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <PressScale label="Choose how hard you push" onPress={() => setPage(1)}>
                  <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.white }}>Choose how hard you push</Text>
                  </View>
                </PressScale>
              </>
            ) : null}
            {page === 1 ? (
              <>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.honeyInk }}>SPARKS</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {SPARK_PRESETS.map((preset) => {
                    const on = amount === preset;
                    return (
                      <Pressable key={preset} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { hapticSelect(); setAmount(preset); }} style={{ minWidth: 76, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.gold : colors.line, backgroundColor: on ? colors.goldSoft : colors.stage, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <Lightning size={14} color={colors.gold} weight="fill" />
                        <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>{preset}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput value={String(amount)} onChangeText={(value) => setAmount(Number(value.replace(/\D/g, "")) || 0)} keyboardType="number-pad" accessibilityLabel="Opening Sparks" style={{ minHeight: 44, borderRadius: 12, backgroundColor: colors.stage, color: colors.ink, paddingHorizontal: 12, fontFamily: fonts.regular }} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{balance == null ? "Sparks balance is still loading." : `${balance.toLocaleString()} Sparks available`}. More Sparks move this closer to the line. They cannot buy the answer.</Text>
                {short ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>Not enough Sparks for that opening. Claim this month's Sparks without leaving the Room.</Text> : null}
                {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{error}</Text> : null}
                <PressScale label="Claim monthly Sparks" onPress={onClaim}><Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>Claim monthly Sparks</Text></PressScale>
                <PressScale label="Continue to the seal" onPress={() => setPage(2)} disabled={short || amount < 10}>
                  <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.white }}>Continue to the seal</Text>
                  </View>
                </PressScale>
              </>
            ) : null}
            {page === 2 ? (
              <>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>{ULTRA_PATHS.find((item) => item.id === path)?.label} · {amount} Sparks</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>Hold to put this on the record. The Room will show the card, the progress, and who is already behind it.</Text>
                {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{error}</Text> : null}
                <SealButton disabled={busy || short || amount < 10} onSeal={() => onCreate(path, amount)} />
                {busy ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft }}>Putting it on the record…</Text> : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </PartialSheet>
    </Pressable>
  );
}
