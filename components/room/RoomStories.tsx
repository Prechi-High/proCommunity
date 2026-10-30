import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";

import { CaretRight, Lightning, Plus } from "@/components/icons";
import { SparkBurst } from "@/components/unmask-ui/SparkBurst";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { ULTRA_PATHS, type RoomTimeline, type RoomUltra, type UltraPath } from "@/lib/room/cards";
import { ULTRA_UNMASK_SPARK_GOAL, sparkProgress } from "@/lib/unmask/status";

import { PartialSheet, PressScale, RisingBar } from "./motion";

export function ExperienceCard({ item, onOpen, onDeeper }: { item: RoomTimeline; onOpen: () => void; onDeeper: () => void }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.stage, padding: 12, gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.productName} experience`} onPress={onOpen} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandDeep, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: 44, height: 44 }} /> : <Text style={{ color: colors.white, fontFamily: fonts.semibold }}>{item.productName.slice(0, 1)}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{item.productName}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{item.brand ? `${item.brand} · ` : ""}{item.duration} · {item.author}</Text>
          </View>
          <CaretRight size={16} color={colors.inkSoft} />
        </Pressable>
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink }}>{item.outcome}</Text>
        <View style={{ flexDirection: "row", gap: 4, alignItems: "flex-end", height: 18 }}>
          {(item.reactions.length ? item.reactions : ["In progress"]).slice(0, 6).map((chip, index) => (
            <View key={chip} style={{ width: 8 + index * 3, height: 6 + (index % 3) * 4, borderRadius: 2, backgroundColor: colors.brand }} />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {item.reactions.slice(0, 3).map((chip) => (
            <View key={chip} style={{ paddingHorizontal: 8, minHeight: 24, borderRadius: 999, backgroundColor: colors.hiSoft, justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.hiInk }}>{chip}</Text>
            </View>
          ))}
        </View>
        <PressScale label="Expand experience" onPress={onOpen}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft }}>Expand</Text>
        </PressScale>
        <PressScale label="Take this further" onPress={onDeeper}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.brand }}>Take this further</Text>
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
  const reduced = useReducedMotion();
  if (!open) return null;
  return (
    <Pressable accessibilityLabel="Close timelines" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", alignItems: "center", zIndex: 4 }}>
      <PartialSheet onClose={onClose}>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} style={{ width: "100%", maxHeight: "55%", backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>Your product timeline</Text>
          {items.length ? items.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Attach ${item.productName}`} onPress={() => onPick(item)} style={{ minHeight: 52, justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{item.productName}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>{item.duration} · {item.outcome}</Text>
            </Pressable>
          )) : <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>No timeline yet. Start one for the product in this Room.</Text>}
          {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{error}</Text> : null}
          <PressScale label="Start a timeline" onPress={onCreate} disabled={busy}><Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>{busy ? "Starting…" : "Start a timeline"}</Text></PressScale>
        </Animated.View>
      </PartialSheet>
    </Pressable>
  );
}

export function ExperienceSheet({ item, onClose, onDeeper }: { item: RoomTimeline | null; onClose: () => void; onDeeper: () => void }) {
  if (!item) return null;
  return (
    <Pressable accessibilityLabel="Close experience" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center", zIndex: 5 }}>
      <PartialSheet onClose={onClose}>
        <View style={{ width: "100%", backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingTop: 4, gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink }}>{item.productName}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>{item.brand || "Product"} · {item.duration} · {item.author}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.ink }}>{item.outcome}</Text>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "flex-end", height: 28 }}>
            {(item.reactions.length ? item.reactions : ["In progress"]).slice(0, 8).map((chip, index) => (
              <View key={`${chip}-${index}`} style={{ flex: 1, height: 8 + (index % 4) * 5, borderRadius: 3, backgroundColor: colors.brand }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {item.reactions.map((chip) => <Text key={chip} style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{chip}</Text>)}
          </View>
          <PressScale label="Take this further" onPress={onDeeper}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.brand }}>Take this further</Text></PressScale>
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
    <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(16)} style={{ borderRadius: 16, borderWidth: 1, borderColor: card.pinned ? colors.brand : colors.line, backgroundColor: colors.stage, padding: 12, gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.brand }}>{card.pinned ? "Highlighted · " : ""}Ultra Unmask · {path}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{card.title}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{card.productName} · {card.author}</Text>
      <RisingBar ratio={progress.ratio} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}>{card.sparks.toLocaleString()} of {progress.goal.toLocaleString()} Sparks · {card.supporters.length} {card.supporters.length === 1 ? "person" : "people"}</Text>
      <View style={{ flexDirection: "row" }}>
        {card.supporters.slice(0, 5).map((person, index) => (
          <View key={`${person.name}-${index}`} style={{ width: 24, height: 24, borderRadius: 12, marginRight: -6, backgroundColor: colors.brandDeep, borderWidth: 1, borderColor: colors.stage, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.white }}>{person.name.slice(0, 1)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <PressScale label="Add Sparks" onPress={onSpark}><Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>Add Sparks</Text></PressScale>
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
    </Animated.View>
  );
}

export function UltraCreate({
  open,
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
  const [amount, setAmount] = useState("10");
  useEffect(() => { if (open) { setPath("why"); setAmount("10"); } }, [open]);
  if (!open) return null;
  const n = Number(amount);
  const short = balance != null && Number.isFinite(n) && n > balance;
  return (
    <Pressable accessibilityLabel="Close Ultra Unmask" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center", zIndex: 6 }}>
      <PartialSheet onClose={onClose}>
      <ScrollView style={{ width: "100%", maxHeight: height * 0.72, backgroundColor: colors.wine, borderTopLeftRadius: 22, borderTopRightRadius: 22 }} contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink }}>Take this further</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{productName}{timeline ? ` · ${timeline.duration}` : ""}. An opening Spark starts the Ultra Unmask. It does not promise a company reply.</Text>
        {ULTRA_PATHS.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: path === item.id }} onPress={() => { hapticSelect(); setPath(item.id); }} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: path === item.id ? colors.brand : colors.ink }}>{item.label}</Text>
          </Pressable>
        ))}
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" accessibilityLabel="Opening Sparks" style={{ minHeight: 44, borderRadius: 12, backgroundColor: colors.stage, color: colors.ink, paddingHorizontal: 12, fontFamily: fonts.regular }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft }}>{balance == null ? "Sparks balance is still loading." : `${balance.toLocaleString()} Sparks available`}</Text>
        {short ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>Not enough Sparks for that opening. Claim this month's Sparks without leaving the Room.</Text> : null}
        {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.coral }}>{error}</Text> : null}
        <PressScale label="Claim monthly Sparks" onPress={onClaim}><Text style={{ fontFamily: fonts.semibold, color: colors.honeyInk }}>Claim monthly Sparks</Text></PressScale>
        <PressScale label={busy ? "Starting" : "Release into the Room"} onPress={() => onCreate(path, n)} disabled={busy}>
          <View style={{ minHeight: 48, borderRadius: 999, backgroundColor: colors.brandDeep, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
            <Lightning size={16} color={colors.white} weight="fill" />
            <Text style={{ fontFamily: fonts.bold, color: colors.white }}>{busy ? "Starting…" : "Release into the Room"}</Text>
          </View>
        </PressScale>
      </ScrollView>
      </PartialSheet>
    </Pressable>
  );
}

export function AttachChip({ attached, label, onPress }: { attached: boolean; label?: string; onPress: () => void }) {
  const reduced = useReducedMotion();
  return (
    <PressScale label={attached ? "Product timeline attached" : "Attach product timeline"} onPress={onPress}>
      <View style={{ minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: attached ? 8 : 0, backgroundColor: attached ? colors.hiSoft : "transparent", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 }}>
        <Plus size={18} color={colors.brand} />
        {attached && label ? (
          <Animated.Text entering={reduced ? undefined : ZoomIn.springify().damping(14)} numberOfLines={1} style={{ maxWidth: 72, fontFamily: fonts.medium, fontSize: 11, color: colors.brand }}>{label}</Animated.Text>
        ) : null}
      </View>
    </PressScale>
  );
}
